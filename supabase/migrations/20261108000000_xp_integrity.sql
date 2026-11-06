-- MindCraft Journey: closes three ways to earn XP that the first version allowed.
-- Rewards stay server-decided, and none of this can stop work from saving.

-- ---------------------------------------------------------------------------
-- A check-in's age decides whether resolving a blocker earns XP, so the database
-- sets it. Browsers can no longer choose or change created_at.
-- ---------------------------------------------------------------------------

create or replace function public.lock_check_in_created_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at := case when tg_op = 'UPDATE' then old.created_at else now() end;
  return new;
end;
$$;

create trigger check_ins_created_at before insert or update on public.check_ins
  for each row execute function public.lock_check_in_created_at();

-- ---------------------------------------------------------------------------
-- A deleted task keeps its deadline snapshot, so Undo brings back the first
-- deadline instead of letting a task start over with a later one. Nobody can read
-- or write this table directly. user_id has no foreign key on purpose: a task
-- deleted along with its account must not fail on a row pointing at that account.
-- ---------------------------------------------------------------------------

create table public.deleted_task_deadlines (
  task_id uuid primary key,
  user_id uuid not null,
  xp_deadline timestamptz not null,
  xp_deadline_set_at timestamptz not null,
  deleted_at timestamptz not null default now()
);

alter table public.deleted_task_deadlines enable row level security;
revoke all on public.deleted_task_deadlines from public, anon, authenticated;

create or replace function public.keep_deleted_task_deadline()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.xp_deadline is not null then
    begin
      delete from deleted_task_deadlines where deleted_at < now() - interval '30 days';
      insert into deleted_task_deadlines (task_id, user_id, xp_deadline, xp_deadline_set_at)
      values (old.id, old.user_id, old.xp_deadline, old.xp_deadline_set_at)
      on conflict (task_id) do update
      set xp_deadline = excluded.xp_deadline, xp_deadline_set_at = excluded.xp_deadline_set_at, deleted_at = now();
    exception when others then
      raise warning 'Could not keep a deleted task deadline: %', sqlerrm;
    end;
  end if;
  return old;
end;
$$;

create trigger tasks_keep_deadline before delete on public.tasks
  for each row execute function public.keep_deleted_task_deadline();

create or replace function public.lock_task_deadline_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    new.xp_deadline := old.xp_deadline;
    new.xp_deadline_set_at := old.xp_deadline_set_at;
  else
    new.xp_deadline := null;
    new.xp_deadline_set_at := null;
    delete from deleted_task_deadlines
    where task_id = new.id and user_id = new.user_id
    returning xp_deadline, xp_deadline_set_at into new.xp_deadline, new.xp_deadline_set_at;
  end if;
  if new.xp_deadline is null and new.due_date is not null then
    new.xp_deadline := public.deadline_instant(new.due_date, new.due_time, new.user_id);
    new.xp_deadline_set_at := now();
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- People choose their own deadlines, so a far-away one can't be proven false. A
-- daily limit keeps that from adding up: five bonuses in any 24 hours.
-- ---------------------------------------------------------------------------

create or replace function public.award_xp(p_user uuid, p_action text, p_amount integer, p_key text, p_label text, p_task uuid, p_check_in uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  daily_limit integer;
  inserted uuid;
begin
  daily_limit := case p_action when 'task_complete' then 20 when 'early_bonus' then 5 when 'blocker_resolved' then 5 when 'focus_start' then 10 when 'first_step' then 10 end;
  if daily_limit is not null
     and (select count(*) from xp_transactions where user_id = p_user and action = p_action and created_at > now() - interval '24 hours') >= daily_limit then
    return false;
  end if;

  insert into xp_transactions (user_id, action, amount, source_key, label, task_id, check_in_id)
  values (p_user, p_action, p_amount, p_key, left(p_label, 200), p_task, p_check_in)
  on conflict (user_id, action, source_key) do nothing
  returning id into inserted;
  if inserted is null then
    return false;
  end if;

  insert into user_progress (user_id, total_xp) values (p_user, p_amount)
  on conflict (user_id) do update set total_xp = user_progress.total_xp + p_amount, updated_at = now();
  return true;
end;
$$;

revoke execute on function public.lock_check_in_created_at() from public, anon, authenticated;
revoke execute on function public.keep_deleted_task_deadline() from public, anon, authenticated;
