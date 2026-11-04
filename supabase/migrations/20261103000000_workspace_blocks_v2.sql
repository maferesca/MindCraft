-- Adds what the seven workspace blocks need: projects, review checklists,
-- resources, check-ins, optional deadline times, and note pinning.
-- Every new table follows the same owner-only RLS rules as the initial schema.

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index projects_unique_name on public.projects (user_id, lower(name));

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column project_id uuid references public.projects (id) on delete set null,
  add column assignee text check (char_length(assignee) <= 120),
  -- Optional. A deadline without a time is a date-only, all-day deadline.
  add column due_time time;

-- Blocked is no longer a status. Those tasks are started work.
update public.tasks set status = 'in_progress' where status = 'blocked';
alter table public.tasks drop constraint tasks_status_check;
alter table public.tasks add constraint tasks_status_check check (status in ('todo', 'in_progress', 'done'));

-- Review criteria are separate from steps, and neither one completes the task.
create table public.task_review_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  position integer not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_review_items_task on public.task_review_items (task_id);

-- ---------------------------------------------------------------------------
-- Notes
-- ---------------------------------------------------------------------------

alter table public.notes
  add column pinned boolean not null default false,
  add column project_id uuid references public.projects (id) on delete set null,
  add constraint notes_one_link check (task_id is null or project_id is null);

-- ---------------------------------------------------------------------------
-- Resources (saved references; the linked document itself is never touched)
-- ---------------------------------------------------------------------------

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  url text not null check (char_length(url) <= 2000 and url ~* '^https?://'),
  description text check (char_length(description) <= 1000),
  favorite boolean not null default false,
  task_id uuid references public.tasks (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (task_id is null or project_id is null)
);
create index resources_user on public.resources (user_id);

-- ---------------------------------------------------------------------------
-- Check-ins. Entries are private drafts: sharing with others is not built yet.
-- ---------------------------------------------------------------------------

create table public.check_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('progress', 'help')),
  -- A reference, so the current task title and status always show.
  task_id uuid references public.tasks (id) on delete set null,
  completed_text text check (char_length(completed_text) <= 4000),
  next_text text check (char_length(next_text) <= 4000),
  blocking text check (char_length(blocking) <= 4000),
  support text check (char_length(support) <= 4000),
  help_status text check (help_status in ('open', 'waiting', 'resolved')),
  follow_ups jsonb not null default '[]'::jsonb
    check (jsonb_typeof(follow_ups) = 'array' and pg_column_size(follow_ups) < 16000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'progress' or coalesce(completed_text, '') <> '' or coalesce(next_text, '') <> ''),
  check (kind <> 'help' or (coalesce(blocking, '') <> '' and coalesce(support, '') <> '' and help_status is not null))
);
create index check_ins_user on public.check_ins (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Block types
-- ---------------------------------------------------------------------------

alter table public.workspace_blocks drop constraint workspace_blocks_block_type_check;
alter table public.workspace_blocks add constraint workspace_blocks_block_type_check
  check (block_type in ('task_list', 'calendar', 'next_step', 'focus_timer', 'notes', 'resources', 'check_in'));

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger task_review_items_touch before update on public.task_review_items for each row execute function public.touch_updated_at();
create trigger resources_touch before update on public.resources for each row execute function public.touch_updated_at();
create trigger check_ins_touch before update on public.check_ins for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array['projects', 'task_review_items', 'resources', 'check_ins']
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format(
      'create policy "Owners can read" on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name);
    execute format(
      'create policy "Owners can insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name);
    execute format(
      'create policy "Owners can update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name);
    execute format(
      'create policy "Owners can delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name);
  end loop;
end;
$$;

-- New tables are not exposed automatically on every Supabase project. RLS still
-- limits each row to its owner. The anon role gets no access.
grant select, insert, update, delete on public.projects, public.task_review_items, public.resources, public.check_ins to authenticated;

-- Linked rows must belong to the same owner (see the initial schema).
create or replace function public.ensure_same_owner_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linked_task uuid;
  linked_project uuid;
begin
  if tg_table_name in ('task_steps', 'task_review_items', 'notes', 'calendar_events', 'resources', 'check_ins') then
    linked_task := new.task_id;
  end if;
  if tg_table_name in ('tasks', 'notes', 'resources') then
    linked_project := new.project_id;
  end if;

  if linked_task is not null
     and not exists (select 1 from tasks where id = linked_task and user_id = new.user_id) then
    raise exception 'Task not found';
  end if;
  if linked_project is not null
     and not exists (select 1 from projects where id = linked_project and user_id = new.user_id) then
    raise exception 'Project not found';
  end if;

  if tg_table_name = 'workspace_blocks' then
    if not exists (select 1 from workspaces where id = new.workspace_id and user_id = new.user_id) then
      raise exception 'Workspace not found';
    end if;
  elsif tg_table_name = 'messages' then
    if not exists (select 1 from conversations where id = new.conversation_id and user_id = new.user_id) then
      raise exception 'Conversation not found';
    end if;
  end if;
  return new;
end;
$$;

create trigger tasks_owner before insert or update on public.tasks for each row execute function public.ensure_same_owner_links();
create trigger task_review_items_owner before insert or update on public.task_review_items for each row execute function public.ensure_same_owner_links();
create trigger resources_owner before insert or update on public.resources for each row execute function public.ensure_same_owner_links();
create trigger check_ins_owner before insert or update on public.check_ins for each row execute function public.ensure_same_owner_links();

revoke execute on function public.ensure_same_owner_links() from public, anon, authenticated;
