-- Task blocks with their own tasks, and named work groups of blocks.
-- Nothing is copied or moved here. A task with no block appears in the oldest
-- task block, so every existing task stays visible and keeps its identity.

-- Removing a block must never remove its tasks, so the link is only cleared.
alter table public.tasks
  add column block_id uuid references public.workspace_blocks (id) on delete set null;
create index tasks_block on public.tasks (block_id);

-- A group exists while at least one block carries its id. Each block belongs to
-- one group at most, so groups cannot contain other groups.
alter table public.workspace_blocks
  add column group_id uuid,
  add column group_title text check (char_length(group_title) <= 60);

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

  if tg_table_name = 'tasks' then
    if new.block_id is not null
       and not exists (select 1 from workspace_blocks where id = new.block_id and user_id = new.user_id and block_type = 'task_list') then
      raise exception 'Task block not found';
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

revoke execute on function public.ensure_same_owner_links() from public, anon, authenticated;
