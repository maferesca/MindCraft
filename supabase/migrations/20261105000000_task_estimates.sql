-- An editable planning estimate in minutes. It is optional, and null means
-- that nobody has estimated the task. It never affects task completion.
alter table public.tasks
  add column estimated_minutes integer
  check (estimated_minutes between 1 and 600);
