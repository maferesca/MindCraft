-- MindCraft Journey: XP, levels, and achievements.
-- The database decides every reward. Browsers can read their own progress, but
-- no client can write it: there are no write policies, and the helper functions
-- that award XP cannot be called directly. Rewards never affect saving work, and
-- XP is never subtracted.

-- ---------------------------------------------------------------------------
-- Deadline snapshot: the first deadline a task received, kept for the early
-- completion bonus. Changing a task's deadline later never changes it.
-- ---------------------------------------------------------------------------

alter table public.tasks
  add column xp_deadline timestamptz,
  add column xp_deadline_set_at timestamptz;

-- A date-only deadline lasts until the end of that day in the person's timezone.
create or replace function public.deadline_instant(p_date date, p_time time, p_user uuid)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  zone text;
begin
  select timezone into zone from profiles where user_id = p_user;
  return (p_date + coalesce(p_time, time '23:59:59')) at time zone coalesce(zone, 'UTC');
exception when others then
  return (p_date + coalesce(p_time, time '23:59:59')) at time zone 'UTC';
end;
$$;

-- Existing tasks keep their current deadline, counted from when they were created.
alter table public.tasks disable trigger tasks_touch;
update public.tasks
set xp_deadline = public.deadline_instant(due_date, due_time, user_id), xp_deadline_set_at = created_at
where due_date is not null;
alter table public.tasks enable trigger tasks_touch;

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
  end if;
  if new.xp_deadline is null and new.due_date is not null then
    new.xp_deadline := public.deadline_instant(new.due_date, new.due_time, new.user_id);
    new.xp_deadline_set_at := now();
  end if;
  return new;
end;
$$;

create trigger tasks_deadline_snapshot before insert or update on public.tasks
  for each row execute function public.lock_task_deadline_snapshot();

-- ---------------------------------------------------------------------------
-- Progress records
-- ---------------------------------------------------------------------------

create table public.xp_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null check (action in ('focus_start', 'task_complete', 'early_bonus', 'blocker_resolved', 'first_step')),
  amount integer not null check (amount > 0),
  -- Survives deleting the task, so a reward can never be earned twice for one record.
  source_key text not null,
  task_id uuid references public.tasks (id) on delete set null,
  check_in_id uuid references public.check_ins (id) on delete set null,
  label text not null check (char_length(label) <= 200),
  created_at timestamptz not null default now(),
  unique (user_id, action, source_key)
);
create index xp_transactions_user_time on public.xp_transactions (user_id, created_at desc);

create table public.user_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  total_xp integer not null default 0 check (total_xp >= 0),
  updated_at timestamptz not null default now()
);

create table public.user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement text not null check (achievement in ('first_step', 'focus_explorer', 'problem_solver', 'early_bird', 'task_builder')),
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement)
);

-- Times come from the server, so a session cannot be claimed without passing time.
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  counted boolean not null default false
);
create unique index focus_sessions_one_open on public.focus_sessions (user_id) where finished_at is null;

do $$
declare
  name text;
begin
  foreach name in array array['xp_transactions', 'user_progress', 'user_achievements', 'focus_sessions'] loop
    execute format('alter table public.%I enable row level security', name);
    execute format('create policy "Owners can read" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', name);
    execute format('revoke all on public.%I from anon, authenticated', name);
    execute format('grant select on public.%I to authenticated', name);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Awarding
-- ---------------------------------------------------------------------------

-- Up to 15 XP by the share of time left. Very short windows can't earn much, and a
-- task finished right after its deadline was set earns nothing, so a far-away
-- deadline on a new task is not free XP.
create or replace function public.xp_deadline_bonus(p_deadline timestamptz, p_set_at timestamptz, p_completed timestamptz)
returns integer
language plpgsql
immutable
as $$
declare
  available numeric;
  remaining numeric;
  ratio numeric;
  bonus integer;
begin
  if p_deadline is null or p_set_at is null then
    return 0;
  end if;
  available := extract(epoch from p_deadline - p_set_at);
  remaining := extract(epoch from p_deadline - p_completed);
  if available < 3600 or remaining <= 0 or extract(epoch from p_completed - p_set_at) < 300 then
    return 0;
  end if;
  ratio := least(1, remaining / available);
  bonus := case when ratio >= 0.5 then 15 when ratio >= 0.2 then 10 else 5 end;
  if available < 21600 then
    bonus := least(bonus, 5);
  end if;
  return bonus;
end;
$$;

-- The one place XP is written. The unique key makes every retry harmless, and the
-- daily limits stop creating and completing throwaway records for XP.
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
  daily_limit := case p_action when 'task_complete' then 20 when 'blocker_resolved' then 5 when 'focus_start' then 10 when 'first_step' then 10 end;
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

create or replace function public.grant_achievements(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  completed integer;
begin
  select count(*) into completed from xp_transactions where user_id = p_user and action = 'task_complete';
  if completed >= 1 then
    insert into user_achievements (user_id, achievement) values (p_user, 'first_step') on conflict do nothing;
  end if;
  if completed >= 10 then
    insert into user_achievements (user_id, achievement) values (p_user, 'task_builder') on conflict do nothing;
  end if;
  if exists (select 1 from xp_transactions where user_id = p_user and action = 'blocker_resolved') then
    insert into user_achievements (user_id, achievement) values (p_user, 'problem_solver') on conflict do nothing;
  end if;
  if exists (select 1 from xp_transactions where user_id = p_user and action = 'early_bonus' and amount = 15) then
    insert into user_achievements (user_id, achievement) values (p_user, 'early_bird') on conflict do nothing;
  end if;
  if (select count(*) from focus_sessions where user_id = p_user and counted) >= 3 then
    insert into user_achievements (user_id, achievement) values (p_user, 'focus_explorer') on conflict do nothing;
  end if;
end;
$$;

-- Runs with the save that completes the task. A problem here must never stop the
-- task from saving, so it is logged instead of raised.
create or replace function public.handle_task_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  task_key text := 'task:' || new.id;
  bonus integer;
begin
  if new.status <> 'done' or old.status = 'done' then
    return new;
  end if;
  begin
    -- The same title again within a day is treated as the same work.
    if exists (
      select 1 from xp_transactions
      where user_id = new.user_id and action = 'task_complete' and source_key <> task_key
        and lower(trim(label)) = lower(trim(new.title)) and created_at > now() - interval '24 hours'
    ) then
      return new;
    end if;
    if award_xp(new.user_id, 'task_complete', 20, task_key, new.title, new.id, null) then
      bonus := xp_deadline_bonus(new.xp_deadline, new.xp_deadline_set_at, now());
      if bonus > 0 then
        perform award_xp(new.user_id, 'early_bonus', bonus, task_key, new.title, new.id, null);
      end if;
      perform grant_achievements(new.user_id);
    end if;
  exception when others then
    raise warning 'Task reward failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger tasks_rewards after update of status on public.tasks
  for each row execute function public.handle_task_rewards();

-- A blocker counts once it has been recorded for a few minutes, so writing one and
-- resolving it straight away earns nothing.
create or replace function public.handle_blocker_rewards()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind <> 'help' or new.help_status <> 'resolved' or old.help_status = 'resolved' or new.created_at > now() - interval '5 minutes' then
    return new;
  end if;
  begin
    if award_xp(new.user_id, 'blocker_resolved', 10, 'check_in:' || new.id, coalesce(new.blocking, 'Blocker'), new.task_id, new.id) then
      perform grant_achievements(new.user_id);
    end if;
  exception when others then
    raise warning 'Blocker reward failed: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger check_ins_rewards after update of help_status on public.check_ins
  for each row execute function public.handle_blocker_rewards();

-- ---------------------------------------------------------------------------
-- Actions the database cannot see on its own. Each one checks the caller's own
-- records and takes no amount, so the browser can only ask, never decide.
-- ---------------------------------------------------------------------------

create or replace function public.award_focus_start(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  task_title text;
begin
  select title into task_title from tasks where id = p_task and user_id = caller and status <> 'done';
  if task_title is not null then
    perform award_xp(caller, 'focus_start', 5, 'task:' || p_task, task_title, p_task, null);
  end if;
end;
$$;

create or replace function public.award_first_step(p_task uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
  task_title text;
  first_done boolean;
begin
  select title into task_title from tasks where id = p_task and user_id = caller;
  select done into first_done from task_steps where task_id = p_task and user_id = caller order by position, created_at limit 1;
  if task_title is not null and first_done then
    perform award_xp(caller, 'first_step', 5, 'task:' || p_task, task_title, p_task, null);
  end if;
end;
$$;

-- Starting again replaces the open session, so restarting a timer counts for nothing.
create or replace function public.begin_focus_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then
    return;
  end if;
  delete from focus_sessions where user_id = caller and finished_at is null;
  insert into focus_sessions (user_id) values (caller);
end;
$$;

-- A session needs at least five minutes on the server's clock to count.
create or replace function public.finish_focus_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  update focus_sessions
  set finished_at = now(), counted = now() - started_at >= interval '5 minutes'
  where user_id = caller and finished_at is null;
  perform grant_achievements(caller);
end;
$$;

revoke execute on function public.deadline_instant(date, time, uuid) from public, anon, authenticated;
revoke execute on function public.lock_task_deadline_snapshot() from public, anon, authenticated;
revoke execute on function public.xp_deadline_bonus(timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke execute on function public.award_xp(uuid, text, integer, text, text, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.grant_achievements(uuid) from public, anon, authenticated;
revoke execute on function public.handle_task_rewards() from public, anon, authenticated;
revoke execute on function public.handle_blocker_rewards() from public, anon, authenticated;

revoke execute on function public.award_focus_start(uuid) from public, anon;
revoke execute on function public.award_first_step(uuid) from public, anon;
revoke execute on function public.begin_focus_session() from public, anon;
revoke execute on function public.finish_focus_session() from public, anon;
grant execute on function public.award_focus_start(uuid) to authenticated;
grant execute on function public.award_first_step(uuid) to authenticated;
grant execute on function public.begin_focus_session() to authenticated;
grant execute on function public.finish_focus_session() to authenticated;
