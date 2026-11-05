import { earlyBonus } from "../xp";
import type { Row, TableName } from "./repository";

// The local demo has no database, so this mirrors what the Supabase migration does.
// Real accounts never use it: their rewards are decided by the database.

type Rows = (table: TableName) => Row[];

const DAILY_LIMITS: Record<string, number> = { task_complete: 20, blocker_resolved: 5, focus_start: 10, first_step: 10 };
const DAY_MS = 86_400_000;

const isRecent = (row: Row, now: number) => now - new Date(row.created_at as string).getTime() < DAY_MS;
const sameText = (a: unknown, b: unknown) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function deadlineMs(task: Row) {
  return new Date(`${task.due_date}T${task.due_time ?? "23:59:59"}`).getTime();
}

export function snapshotDeadline(task: Row, previous?: Row) {
  task.xp_deadline = previous?.xp_deadline ?? null;
  task.xp_deadline_set_at = previous?.xp_deadline_set_at ?? null;
  if (!task.xp_deadline && task.due_date) {
    task.xp_deadline = new Date(deadlineMs(task)).toISOString();
    task.xp_deadline_set_at = new Date().toISOString();
  }
}

function award(rows: Rows, action: string, amount: number, key: string, label: string, links: Row = {}) {
  const now = Date.now();
  const log = rows("xp_transactions");
  const limit = DAILY_LIMITS[action];
  if (limit && log.filter((row) => row.action === action && isRecent(row, now)).length >= limit) return false;
  if (log.some((row) => row.action === action && row.source_key === key)) return false;
  log.push({ id: crypto.randomUUID(), action, amount, source_key: key, label, created_at: new Date(now).toISOString(), ...links });
  const progress = rows("user_progress");
  if (!progress.length) progress.push({ total_xp: 0 });
  progress[0].total_xp = (progress[0].total_xp as number) + amount;
  return true;
}

function grantAchievements(rows: Rows) {
  const log = rows("xp_transactions");
  const completed = log.filter((row) => row.action === "task_complete").length;
  const earned: string[] = [];
  if (completed >= 1) earned.push("first_step");
  if (completed >= 10) earned.push("task_builder");
  if (log.some((row) => row.action === "blocker_resolved")) earned.push("problem_solver");
  if (log.some((row) => row.action === "early_bonus" && row.amount === 15)) earned.push("early_bird");
  if (rows("focus_sessions").filter((row) => row.counted).length >= 3) earned.push("focus_explorer");
  const unlocked = rows("user_achievements");
  for (const achievement of earned) {
    if (!unlocked.some((row) => row.achievement === achievement)) unlocked.push({ achievement, unlocked_at: new Date().toISOString() });
  }
}

export function rewardCompletedTask(rows: Rows, task: Row) {
  const key = `task:${task.id}`;
  const now = Date.now();
  const repeated = rows("xp_transactions").some((row) => row.action === "task_complete" && row.source_key !== key && sameText(row.label, task.title) && isRecent(row, now));
  if (repeated || !award(rows, "task_complete", 20, key, task.title as string, { task_id: task.id })) return;
  const deadline = task.xp_deadline ? new Date(task.xp_deadline as string).getTime() : null;
  const setAt = task.xp_deadline_set_at ? new Date(task.xp_deadline_set_at as string).getTime() : null;
  const bonus = earlyBonus(deadline, setAt, now);
  if (bonus) award(rows, "early_bonus", bonus, key, task.title as string, { task_id: task.id });
  grantAchievements(rows);
}

export function rewardResolvedBlocker(rows: Rows, entry: Row) {
  if (Date.now() - new Date(entry.created_at as string).getTime() < 5 * 60_000) return;
  if (award(rows, "blocker_resolved", 10, `check_in:${entry.id}`, (entry.blocking as string) ?? "Blocker", { check_in_id: entry.id, task_id: entry.task_id })) grantAchievements(rows);
}

export function rewardFocusStart(rows: Rows, taskId: string) {
  const task = rows("tasks").find((row) => row.id === taskId && row.status !== "done");
  if (task) award(rows, "focus_start", 5, `task:${taskId}`, task.title as string, { task_id: taskId });
}

export function rewardFirstStep(rows: Rows, taskId: string) {
  const task = rows("tasks").find((row) => row.id === taskId);
  const first = [...rows("task_steps").filter((row) => row.task_id === taskId)].sort((a, b) => (a.position as number) - (b.position as number))[0];
  if (task && first?.done) award(rows, "first_step", 5, `task:${taskId}`, task.title as string, { task_id: taskId });
}

export function beginLocalFocusSession(rows: Rows) {
  const sessions = rows("focus_sessions");
  const open = sessions.findIndex((row) => !row.finished_at);
  if (open >= 0) sessions.splice(open, 1);
  sessions.push({ started_at: new Date().toISOString(), finished_at: null, counted: false });
}

export function finishLocalFocusSession(rows: Rows) {
  const session = rows("focus_sessions").find((row) => !row.finished_at);
  if (!session) return;
  session.finished_at = new Date().toISOString();
  session.counted = Date.now() - new Date(session.started_at as string).getTime() >= 5 * 60_000;
  grantAchievements(rows);
}
