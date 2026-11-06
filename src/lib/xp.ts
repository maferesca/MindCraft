import type { Achievement, XpAction, XpTransaction } from "./types";

// Levels are personal progress, never a measure of performance. Add a row to extend them.
export const LEVELS = [
  { level: 1, name: "Explorer", xp: 0 },
  { level: 2, name: "Builder", xp: 100 },
  { level: 3, name: "Creator", xp: 250 },
  { level: 4, name: "Architect", xp: 500 },
  { level: 5, name: "Master Builder", xp: 900 },
] as const;

export function levelProgress(totalXp: number) {
  const index = LEVELS.reduce((found, level, position) => (totalXp >= level.xp ? position : found), 0);
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  // Measured from this level's own threshold, because levels are different sizes.
  const percent = next ? Math.round(((totalXp - current.xp) / (next.xp - current.xp)) * 100) : 100;
  return { current, next, percent, toNext: next ? next.xp - totalXp : 0 };
}

export const ACHIEVEMENTS: Record<Achievement, { name: string; description: string }> = {
  first_step: { name: "First Step", description: "Complete your first task." },
  focus_explorer: { name: "Focus Explorer", description: "Complete three focus sessions of at least five minutes." },
  problem_solver: { name: "Problem Solver", description: "Resolve your first recorded blocker." },
  early_bird: { name: "Early Bird", description: "Earn the full early completion bonus." },
  task_builder: { name: "Task Builder", description: "Complete ten tasks." },
};

export const HOW_XP_IS_EARNED = [
  ["Start a task in Focus Mode", "+5"],
  ["Complete a task", "+20"],
  ["Finish before the deadline (up to five a day)", "Up to +15"],
  ["Resolve a recorded blocker", "+10"],
  ["Complete a task's first step in the Task guide", "+5"],
] as const;

const TIME_LABELS: Record<XpAction, string> = {
  focus_start: "Focus Mode started",
  task_complete: "Task completion",
  early_bonus: "Finished ahead of schedule",
  blocker_resolved: "Blocker resolved",
  first_step: "First step completed",
};

export function rewardLine(reward: Pick<XpTransaction, "action" | "amount">) {
  return `+${reward.amount} XP — ${TIME_LABELS[reward.action]}`;
}

// For the recent activity list, where the task's name helps.
export function activityLine(reward: Pick<XpTransaction, "action" | "label">) {
  if (reward.action === "task_complete") return `${reward.label} completed`;
  if (reward.action === "early_bonus") return "Early completion bonus";
  return TIME_LABELS[reward.action];
}

// Short feedback for rewards that just arrived, biggest first.
export function rewardFeedback(rewards: Array<Pick<XpTransaction, "action" | "amount">>) {
  const ordered = [...rewards].sort((a, b) => b.amount - a.amount);
  const total = rewards.reduce((sum, reward) => sum + reward.amount, 0);
  const lines = ordered.map(rewardLine);
  if (rewards.length > 1) lines.push(`Total: +${total} XP`);
  return { title: rewards.some((reward) => reward.action === "task_complete") ? "Task completed!" : "XP earned", lines };
}

const HOUR_MS = 3_600_000;

// The same rule as xp_deadline_bonus in the database, which decides real rewards.
// The local demo has no database, so it uses this one.
export function earlyBonus(deadlineMs: number | null, setAtMs: number | null, completedMs: number) {
  if (deadlineMs === null || setAtMs === null) return 0;
  const available = deadlineMs - setAtMs;
  const remaining = deadlineMs - completedMs;
  if (available < HOUR_MS || remaining <= 0 || completedMs - setAtMs < 5 * 60_000) return 0;
  const ratio = Math.min(1, remaining / available);
  const bonus = ratio >= 0.5 ? 15 : ratio >= 0.2 ? 10 : 5;
  return available < 6 * HOUR_MS ? Math.min(bonus, 5) : bonus;
}
