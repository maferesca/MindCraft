import { addDaysToDateString, dateRange, daysInMonth, minutesFromTime, startOfWeekDate, weekdayOf, zonedParts } from "./dates";
import type { CalendarEvent, Task } from "./types";

export type CalendarItemKind = "deadline" | "event" | "work_session";
export type CalendarScale = "month" | "week" | "day";

export const CALENDAR_KIND_LABELS: Record<CalendarItemKind, string> = {
  deadline: "Deadline",
  event: "Event",
  work_session: "Work session",
};

export interface CalendarItem {
  key: string;
  kind: CalendarItemKind;
  date: string;
  // Minutes after midnight. Null means an all-day item (a date-only deadline).
  startMinute: number | null;
  endMinute: number | null;
  title: string;
  taskId: string | null;
  event: CalendarEvent | null;
}

export interface CalendarFilters {
  projectId: string;
  hiddenKinds: CalendarItemKind[];
}

// Deadlines come straight from the task record. Sessions show the task's current
// title, so nothing about the task is copied into the calendar.
export function buildCalendarItems(tasks: Task[], events: CalendarEvent[], timezone: string, filters: CalendarFilters): CalendarItem[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const items: CalendarItem[] = [];

  for (const task of tasks) {
    if (!task.due_date) continue;
    if (filters.projectId && task.project_id !== filters.projectId) continue;
    const start = minutesFromTime(task.due_time);
    items.push({
      key: `deadline-${task.id}`,
      kind: "deadline",
      date: task.due_date,
      startMinute: start,
      endMinute: start === null ? null : Math.min(start + 30, 1440),
      title: task.title,
      taskId: task.id,
      event: null,
    });
  }

  for (const event of events) {
    const linked = event.task_id ? taskById.get(event.task_id) : undefined;
    if (filters.projectId && linked?.project_id !== filters.projectId) continue;
    const start = zonedParts(event.starts_at, timezone);
    const end = zonedParts(event.ends_at, timezone);
    const startMinute = minutesFromTime(start.time) ?? 0;
    items.push({
      key: event.id,
      kind: event.kind,
      date: start.date,
      startMinute,
      endMinute: end.date === start.date ? minutesFromTime(end.time) : 1440,
      title: event.kind === "work_session" ? linked?.title ?? "Deleted task" : event.title,
      taskId: event.task_id,
      event,
    });
  }

  return items
    .filter((item) => !filters.hiddenKinds.includes(item.kind))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.startMinute ?? -1) - (b.startMinute ?? -1) || a.title.localeCompare(b.title));
}

export function visibleDates(anchor: string, scale: CalendarScale | "agenda", firstDay: 0 | 1, showWeekends: boolean) {
  let dates: string[];
  if (scale === "day") return [anchor];
  if (scale === "week") {
    dates = dateRange(startOfWeekDate(anchor, firstDay), 7);
  } else {
    const first = `${anchor.slice(0, 8)}01`;
    const last = `${anchor.slice(0, 8)}${String(daysInMonth(anchor)).padStart(2, "0")}`;
    if (scale === "agenda") {
      dates = dateRange(first, daysInMonth(anchor));
    } else {
      const gridStart = startOfWeekDate(first, firstDay);
      const gridEnd = addDaysToDateString(startOfWeekDate(last, firstDay), 6);
      const count = Math.round((Date.parse(gridEnd) - Date.parse(gridStart)) / 86_400_000) + 1;
      dates = dateRange(gridStart, count);
    }
  }
  return showWeekends ? dates : dates.filter((date) => ![0, 6].includes(weekdayOf(date)));
}

// Places overlapping timed items side by side.
export function assignLanes(items: CalendarItem[]) {
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const item of items) {
    const start = item.startMinute ?? 0;
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.endMinute ?? start + 30;
    lanes.set(item.key, lane);
  }
  return { lanes, count: Math.max(1, laneEnds.length) };
}

export function minuteLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
}
