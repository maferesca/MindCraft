import { format, parseISO } from "date-fns";
import type { Preferences } from "./preferences";
import type { CheckIn, Task, TaskPriority, TaskStatus, TaskStep } from "./types";

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

export const PRIORITY_LABELS: Record<TaskPriority | "none", string> = { none: "None", low: "Low", medium: "Medium", high: "High" };

const PRIORITY_RANK: Record<TaskPriority | "none", number> = { high: 0, medium: 1, low: 2, none: 3 };

export type TaskFilter = "all" | "today" | "upcoming" | "overdue" | "completed";
export type TaskSort = "deadline" | "priority" | "title";

export const TASK_FILTER_LABELS: Record<TaskFilter, string> = {
  all: "All",
  today: "Today",
  upcoming: "Upcoming",
  overdue: "Overdue",
  completed: "Completed",
};

// Which steps an assistance level shows. Nothing is removed from the task: changing
// level only changes this view, so progress is never lost.
export function stepWindow<T extends { done: boolean }>(steps: T[], level: Preferences["planningStyle"], extraShown = 0) {
  if (level === "short_list") return { shown: steps, doneHidden: 0, laterHidden: 0 };
  const pending = steps.filter((step) => !step.done);
  const shown = pending.slice(0, level === "one_step" ? 1 : 2 + extraShown);
  return { shown, doneHidden: steps.length - pending.length, laterHidden: pending.length - shown.length };
}

export function stepRequestMessage(level: Preferences["planningStyle"], title: string) {
  if (level === "one_step") return `Give me one clear next step for "${title}".`;
  if (level === "short_list") return `Give me 3 to 5 clear steps for "${title}".`;
  return `Break "${title}" into very small, explicit steps.`;
}

// The database requires both fields on a help request, and a person may know what is
// missing before knowing who can help. The interface treats this value as empty.
export const NO_SUPPORT_YET = "Not decided yet";

// Missing information for one task, oldest first, split by whether it still applies.
export function taskBlockers(checkIns: CheckIn[], taskId: string) {
  const entries = checkIns.filter((entry) => entry.kind === "help" && entry.task_id === taskId).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return { open: entries.filter((entry) => entry.help_status !== "resolved"), resolved: entries.filter((entry) => entry.help_status === "resolved") };
}

export function timeLabel(time: string) {
  return time.slice(0, 5);
}

export function formatDeadline(task: Pick<Task, "due_date" | "due_time">) {
  if (!task.due_date) return "No deadline";
  const day = format(parseISO(task.due_date), "EEE d MMM");
  return task.due_time ? `${day}, ${timeLabel(task.due_time)}` : day;
}

export function formatDueDate(date: string) {
  return `Due ${format(parseISO(date), "EEE d MMM")}`;
}

export function isOverdue(task: Task, today: string) {
  return Boolean(task.due_date && task.status !== "done" && task.due_date < today);
}

export function filterTasks(tasks: Task[], filter: TaskFilter, today: string) {
  return tasks.filter((task) => {
    const open = task.status !== "done";
    if (filter === "completed") return !open;
    if (!open) return false;
    if (filter === "today") return task.due_date === today;
    if (filter === "upcoming") return Boolean(task.due_date && task.due_date > today);
    if (filter === "overdue") return Boolean(task.due_date && task.due_date < today);
    return true;
  });
}

function deadlineKey(task: Task) {
  // Tasks without a deadline sort after every dated task.
  return task.due_date ? `${task.due_date} ${task.due_time ?? "99"}` : "9999";
}

export function sortTasks(tasks: Task[], sort: TaskSort) {
  return [...tasks].sort((a, b) => {
    if (sort === "title") return a.title.localeCompare(b.title);
    if (sort === "priority") {
      const difference = PRIORITY_RANK[a.priority ?? "none"] - PRIORITY_RANK[b.priority ?? "none"];
      if (difference) return difference;
    }
    return deadlineKey(a).localeCompare(deadlineKey(b)) || a.title.localeCompare(b.title);
  });
}

export function stepsForTask<T extends Pick<TaskStep, "task_id" | "position" | "created_at">>(steps: T[], taskId: string) {
  return steps.filter((step) => step.task_id === taskId).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
}

// The current step is the first one that is not done yet.
export function currentStep(steps: TaskStep[], taskId: string) {
  return stepsForTask(steps, taskId).find((step) => !step.done) ?? null;
}

export function openTasks(tasks: Task[]) {
  return tasks.filter((task) => task.status !== "done");
}

export function stepProgressLabel(done: number, total: number) {
  return total ? `${done} of ${total} steps completed` : "Add your first step";
}

// Note text stays plain text. Lines starting with "- [ ] " or "- [x] " are
// checklist items that belong only to the note, and "- " lines are bullets.
const CHECK_LINE = /^(\s*)- \[( |x|X)\] ?(.*)$/;

export type NoteLine =
  | { kind: "check"; text: string; checked: boolean }
  | { kind: "bullet"; text: string }
  | { kind: "text"; text: string };

export function parseNoteLine(line: string): NoteLine {
  const check = CHECK_LINE.exec(line);
  if (check) return { kind: "check", text: check[3], checked: check[2].toLowerCase() === "x" };
  if (/^\s*- /.test(line)) return { kind: "bullet", text: line.replace(/^\s*- /, "") };
  return { kind: "text", text: line };
}

export function toggleNoteLine(body: string, index: number) {
  const lines = body.split("\n");
  const line = lines[index];
  if (line === undefined) return body;
  lines[index] = line.replace(/- \[( |x|X)\]/, (match) => (match === "- [ ]" ? "- [x]" : "- [ ]"));
  return lines.join("\n");
}
