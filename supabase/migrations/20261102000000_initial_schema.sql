-- Mindcraft initial schema.
-- Every user-owned table has a user_id column, Row Level Security enabled,
-- and policies that only allow the signed-in owner to read and write rows.
-- Layout (workspace_blocks) is stored separately from content (tasks, notes, events).

-- Keeps updated_at current on every update.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles and preferences
-- ---------------------------------------------------------------------------

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  timezone text not null default 'UTC' check (char_length(timezone) <= 64),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Explicit preferences are stored as validated JSON so new options do not
-- require a migration. The application validates the shape with Zod.
create table public.preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  settings jsonb not null default '{}'::jsonb
    check (jsonb_typeof(settings) = 'object' and pg_column_size(settings) < 16000),
  updated_at timestamptz not null default now()
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  style text not null default 'off' check (style in ('off', 'friendly', 'playful', 'minimal')),
  quiet_hours_start time,
  quiet_hours_end time,
  preferred_time time,
  inactivity_days smallint not null default 2 check (inactivity_days between 1 and 14),
  snoozed_until timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Workspace layout
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default 'My workspace' check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index workspaces_one_per_user on public.workspaces (user_id);

create table public.workspace_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  block_type text not null check (block_type in ('task_list', 'calendar', 'next_step', 'focus_timer', 'notes')),
  title text check (char_length(title) <= 60),
  -- Display options only (compact view, filters). Never task or note content.
  config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(config) = 'object' and pg_column_size(config) < 4000),
  -- Grid positions per breakpoint: {"lg": {"x":0,"y":0,"w":4,"h":6}, "md": {...}}
  layouts jsonb not null default '{}'::jsonb check (jsonb_typeof(layouts) = 'object'),
  -- Order used by the one-column phone layout.
  mobile_order integer not null default 0,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workspace_blocks_workspace on public.workspace_blocks (workspace_id);

-- ---------------------------------------------------------------------------
-- Work content
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 4000),
  expected_result text check (char_length(expected_result) <= 1000),
  -- Optional. A missing deadline stays null; it is never guessed.
  due_date date,
  priority text check (priority in ('low', 'medium', 'high')),
  source_link text check (char_length(source_link) <= 1000),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'blocked', 'done')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user on public.tasks (user_id);

create table public.task_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  position integer not null default 0,
  done boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_steps_task on public.task_steps (task_id);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (char_length(title) <= 200),
  body text not null default '' check (char_length(body) <= 20000),
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_user on public.notes (user_id);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  -- 'work_session' is time-blocked work; 'event' is anything else.
  -- Deadlines are not events: they come from tasks.due_date.
  kind text not null default 'event' check (kind in ('event', 'work_session')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  task_id uuid references public.tasks (id) on delete set null,
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index calendar_events_user on public.calendar_events (user_id, starts_at);

-- ---------------------------------------------------------------------------
-- Assistant history
-- ---------------------------------------------------------------------------

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index conversations_one_per_user on public.conversations (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  -- Optional structured proposal attached to an assistant message.
  proposal jsonb,
  created_at timestamptz not null default now()
);
create index messages_conversation on public.messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Streak
-- ---------------------------------------------------------------------------

-- One row per local calendar day on which the workspace was opened.
create table public.daily_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  local_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, local_date)
);

create table public.streaks (
  user_id uuid primary key references auth.users (id) on delete cascade,
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  last_visit_date date,
  updated_at timestamptz not null default now()
);

-- Records a qualifying visit for the caller using their saved timezone.
-- Runs as the caller (security invoker), so RLS still applies.
create or replace function public.record_workspace_visit()
returns public.streaks
language plpgsql
security invoker
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  tz text;
  today date;
  existing public.streaks;
  result public.streaks;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(timezone, 'UTC') into tz from profiles where user_id = caller;
  begin
    today := (now() at time zone coalesce(tz, 'UTC'))::date;
  exception when others then
    today := (now() at time zone 'UTC')::date;
  end;

  insert into daily_activity (user_id, local_date) values (caller, today)
  on conflict do nothing;

  select * into existing from streaks where user_id = caller;

  if existing.user_id is null then
    insert into streaks (user_id, current_streak, best_streak, last_visit_date)
    values (caller, 1, 1, today)
    returning * into result;
  elsif existing.last_visit_date = today then
    result := existing;
  else
    update streaks
    set current_streak = case when existing.last_visit_date = today - 1 then existing.current_streak + 1 else 1 end,
        best_streak = greatest(existing.best_streak,
          case when existing.last_visit_date = today - 1 then existing.current_streak + 1 else 1 end),
        last_visit_date = today,
        updated_at = now()
    where user_id = caller
    returning * into result;
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- New user bootstrap
-- ---------------------------------------------------------------------------

-- Creates empty profile, preferences, and an empty workspace (no blocks).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (user_id) values (new.id);
  insert into preferences (user_id) values (new.id);
  insert into notification_preferences (user_id) values (new.id);
  insert into workspaces (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger preferences_touch before update on public.preferences for each row execute function public.touch_updated_at();
create trigger notification_preferences_touch before update on public.notification_preferences for each row execute function public.touch_updated_at();
create trigger workspaces_touch before update on public.workspaces for each row execute function public.touch_updated_at();
create trigger workspace_blocks_touch before update on public.workspace_blocks for each row execute function public.touch_updated_at();
create trigger tasks_touch before update on public.tasks for each row execute function public.touch_updated_at();
create trigger task_steps_touch before update on public.task_steps for each row execute function public.touch_updated_at();
create trigger notes_touch before update on public.notes for each row execute function public.touch_updated_at();
create trigger calendar_events_touch before update on public.calendar_events for each row execute function public.touch_updated_at();
create trigger conversations_touch before update on public.conversations for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles', 'preferences', 'notification_preferences', 'workspaces',
    'workspace_blocks', 'tasks', 'task_steps', 'notes', 'calendar_events',
    'conversations', 'messages', 'daily_activity', 'streaks'
  ]
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

-- Linked rows must belong to the same owner. RLS alone would let a user
-- reference another user's task id in a foreign key, so these triggers
-- reject cross-account links.
create or replace function public.ensure_same_owner_links()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'task_steps' then
    if not exists (select 1 from tasks where id = new.task_id and user_id = new.user_id) then
      raise exception 'Task not found';
    end if;
  elsif tg_table_name in ('notes', 'calendar_events') then
    if new.task_id is not null
       and not exists (select 1 from tasks where id = new.task_id and user_id = new.user_id) then
      raise exception 'Task not found';
    end if;
  elsif tg_table_name = 'workspace_blocks' then
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

create trigger task_steps_owner before insert or update on public.task_steps for each row execute function public.ensure_same_owner_links();
create trigger notes_owner before insert or update on public.notes for each row execute function public.ensure_same_owner_links();
create trigger calendar_events_owner before insert or update on public.calendar_events for each row execute function public.ensure_same_owner_links();
create trigger workspace_blocks_owner before insert or update on public.workspace_blocks for each row execute function public.ensure_same_owner_links();
create trigger messages_owner before insert or update on public.messages for each row execute function public.ensure_same_owner_links();

grant execute on function public.record_workspace_visit() to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.ensure_same_owner_links() from public, anon, authenticated;
