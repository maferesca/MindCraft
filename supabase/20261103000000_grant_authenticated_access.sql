begin;

grant usage on schema public to authenticated;

grant select, insert, update, delete
on table
  public.profiles,
  public.preferences,
  public.notification_preferences,
  public.workspaces,
  public.workspace_blocks,
  public.tasks,
  public.task_steps,
  public.notes,
  public.calendar_events,
  public.conversations,
  public.messages,
  public.daily_activity,
  public.streaks
to authenticated;

commit;