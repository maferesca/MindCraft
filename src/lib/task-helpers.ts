import { format, parseISO } from "date-fns";
import type { Task, TaskStatus, TaskStep } from "./types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Done",
};

export const PRIORITY_LABELS = { low: "Low priority", medium: "Medium priority", high: "High priority" } as const;

export function formatDueDate(date: string) {
  return `Due ${format(parseISO(date), "EEE d MMM")}`;
}

export function isOverdue(task: Task, today: string) {
  return Boolean(task.due_date && task.status !== "done" && task.due_date < today);
}

export function stepsForTask(steps: TaskStep[], taskId: string) {
  return steps.filter((step) => step.task_id === taskId).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

// The current step is the first one that is not done yet.
export function currentStep(steps: TaskStep[], taskId: string) {
  return stepsForTask(steps, taskId).find((step) => !step.done) ?? null;
}

export function openTasks(tasks: Task[]) {
  return tasks.filter((task) => task.status !== "done");
}

// Draft built from a template, so a clarification message is available
// without AI. The user edits and sends it through their own channel.
export function clarificationTemplate(taskTitle: string, missing: string[], other: string) {
  const items = [...missing.map((item) => item.toLowerCase()), other.trim()].filter(Boolean);
  const asks = items.length ? items.join(", ") : "a few details";
  return `Hi, I'm working on "${taskTitle}". Before I continue, could you help me with ${asks}? Thank you.`;
}
