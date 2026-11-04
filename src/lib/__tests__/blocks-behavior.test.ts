import { describe, expect, it } from "vitest";
import { buildCalendarItems, visibleDates } from "../calendar";
import { addMonthsToDateString, startOfWeekDate, zonedParts, zonedToIso } from "../dates";
import { DEFAULT_PREFERENCES, normalizePreferences, type TimerSession } from "../preferences";
import { eventInputSchema, helpInputSchema, progressInputSchema, resourceInputSchema, taskInputSchema } from "../schemas";
import { filterTasks, formatDeadline, parseNoteLine, sortTasks, stepProgressLabel, toggleNoteLine } from "../task-helpers";
import * as timer from "../timer";
import type { CalendarEvent, Task } from "../types";

const TODAY = "2026-11-03";

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    user_id: "u",
    title: id,
    description: null,
    expected_result: null,
    due_date: null,
    due_time: null,
    project_id: null,
    assignee: null,
    priority: null,
    source_link: null,
    status: "todo",
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

function session(id: string, extra: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id,
    user_id: "u",
    title: "Work session",
    kind: "work_session",
    starts_at: "2026-11-03T14:00:00Z",
    ends_at: "2026-11-03T15:00:00Z",
    task_id: "a",
    notes: null,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

describe("task filters and sorting", () => {
  const tasks = [
    task("late", { due_date: "2026-11-01" }),
    task("now", { due_date: TODAY }),
    task("later", { due_date: "2026-11-09", priority: "high" }),
    task("open"),
    task("finished", { due_date: TODAY, status: "done" }),
  ];
  const ids = (list: Task[]) => list.map((item) => item.id).sort();

  it("applies each filter", () => {
    expect(ids(filterTasks(tasks, "all", TODAY))).toEqual(["late", "later", "now", "open"]);
    expect(ids(filterTasks(tasks, "today", TODAY))).toEqual(["now"]);
    expect(ids(filterTasks(tasks, "upcoming", TODAY))).toEqual(["later"]);
    expect(ids(filterTasks(tasks, "overdue", TODAY))).toEqual(["late"]);
    expect(ids(filterTasks(tasks, "completed", TODAY))).toEqual(["finished"]);
  });

  it("sorts by deadline with undated tasks last, and by priority", () => {
    expect(sortTasks(tasks, "deadline").map((item) => item.id)).toEqual(["late", "finished", "now", "later", "open"]);
    expect(sortTasks(tasks, "priority")[0].id).toBe("later");
  });

  it("describes missing and timed deadlines", () => {
    expect(formatDeadline(task("a"))).toBe("No deadline");
    expect(formatDeadline(task("a", { due_date: "2026-11-05", due_time: "09:30:00" }))).toBe("Thu 5 Nov, 09:30");
  });

  it("rejects the removed Blocked status", () => {
    expect(taskInputSchema.safeParse({ title: "x", status: "blocked" }).success).toBe(false);
  });
});

describe("timezones", () => {
  it("converts wall-clock time to an instant in the profile timezone", () => {
    expect(zonedToIso("2026-11-03", "09:00", "Europe/Copenhagen")).toBe("2026-11-03T08:00:00.000Z");
    expect(zonedToIso("2026-07-03", "09:00", "Europe/Copenhagen")).toBe("2026-07-03T07:00:00.000Z");
    expect(zonedToIso("2026-11-03", "09:00", "America/Mexico_City")).toBe("2026-11-03T15:00:00.000Z");
  });
  it("shows an instant on the date it falls on in that timezone", () => {
    expect(zonedParts("2026-11-04T02:00:00Z", "America/Mexico_City")).toEqual({ date: "2026-11-03", time: "20:00" });
    expect(zonedParts("2026-11-03T22:30:00Z", "Asia/Tokyo")).toEqual({ date: "2026-11-04", time: "07:30" });
  });
  it("round-trips across a clock change", () => {
    const iso = zonedToIso("2026-03-29", "12:00", "Europe/Copenhagen");
    expect(zonedParts(iso, "Europe/Copenhagen")).toEqual({ date: "2026-03-29", time: "12:00" });
  });
});

describe("calendar", () => {
  const filters = { projectId: "", hiddenKinds: [] };

  it("keeps date-only deadlines all day and places timed ones at their time", () => {
    const items = buildCalendarItems([task("a", { due_date: TODAY }), task("b", { due_date: TODAY, due_time: "16:30:00" })], [], "UTC", filters);
    expect(items.find((item) => item.taskId === "a")?.startMinute).toBeNull();
    expect(items.find((item) => item.taskId === "b")?.startMinute).toBe(990);
  });

  it("names a work session after its task without changing the deadline", () => {
    const tasks = [task("a", { title: "Slides", due_date: "2026-12-01" })];
    const items = buildCalendarItems(tasks, [session("s")], "UTC", filters);
    expect(items.find((item) => item.kind === "work_session")?.title).toBe("Slides");
    expect(items.find((item) => item.kind === "deadline")?.date).toBe("2026-12-01");
  });

  it("filters by type and project", () => {
    const tasks = [task("a", { due_date: TODAY, project_id: "p" }), task("b", { due_date: TODAY })];
    const events = [session("s"), session("e", { kind: "event", task_id: null, title: "Meeting" })];
    expect(buildCalendarItems(tasks, events, "UTC", { projectId: "", hiddenKinds: ["deadline"] }).every((item) => item.kind !== "deadline")).toBe(true);
    expect(buildCalendarItems(tasks, events, "UTC", { projectId: "p", hiddenKinds: [] }).map((item) => item.key).sort()).toEqual(["deadline-a", "s"]);
  });

  it("builds ranges from the first day of the week and hides weekends", () => {
    expect(startOfWeekDate("2026-11-03", 1)).toBe("2026-11-02");
    expect(startOfWeekDate("2026-11-03", 0)).toBe("2026-11-01");
    expect(visibleDates("2026-11-03", "week", 1, false)).toHaveLength(5);
    expect(visibleDates("2026-11-03", "month", 1, true).length % 7).toBe(0);
    expect(addMonthsToDateString("2026-01-31", 1)).toBe("2026-02-28");
  });

  it("requires an end after the start", () => {
    const result = eventInputSchema.safeParse({ title: "x", kind: "event", starts_at: "2026-11-03T10:00:00Z", ends_at: "2026-11-03T09:00:00Z" });
    expect(result.success).toBe(false);
  });
});

describe("focus timer", () => {
  const idle = DEFAULT_PREFERENCES.timer;
  const t0 = 1_000_000;

  it("counts from timestamps, so time passes while the page is away", () => {
    const running = timer.start(idle, t0, 25 * 60_000);
    expect(timer.remainingMs(running, t0 + 60_000)).toBe(24 * 60_000);
  });

  it("freezes on pause and continues on resume", () => {
    const paused = timer.pause(timer.start(idle, t0, 60_000), t0 + 10_000);
    expect(timer.elapsedMs(paused, t0 + 500_000)).toBe(10_000);
    expect(timer.elapsedMs(timer.resume(paused, t0 + 500_000), t0 + 505_000)).toBe(15_000);
  });

  it("keeps a running session through a refresh", () => {
    const running = timer.start(idle, t0, 60_000);
    const restored = normalizePreferences(JSON.parse(JSON.stringify({ timer: running }))).timer as TimerSession;
    expect(restored).toEqual(running);
    expect(timer.hasExpired(restored, t0 + 61_000)).toBe(true);
  });

  it("stops a countdown at zero and a stopwatch keeps counting up", () => {
    const ended = timer.finish(timer.start(idle, t0, 60_000), t0 + 90_000, "zero");
    expect(timer.remainingMs(ended, t0 + 200_000)).toBe(0);
    const stopwatch = timer.start({ ...idle, mode: "stopwatch" }, t0, 0);
    expect(timer.hasExpired(stopwatch, t0 + 10_000_000)).toBe(false);
    expect(timer.elapsedMs(stopwatch, t0 + 5_000)).toBe(5_000);
  });

  it("formats the clock", () => {
    expect(timer.formatClock(25 * 60_000)).toBe("25:00");
    expect(timer.formatClock(3_661_000)).toBe("1:01:01");
  });
});

describe("notes, resources, and check-ins", () => {
  it("toggles a note checkbox in the note's text only", () => {
    const body = "Intro\n- [ ] Buy paper\n- Plain bullet";
    expect(parseNoteLine("- [x] Done")).toEqual({ kind: "check", text: "Done", checked: true });
    expect(parseNoteLine("- Plain")).toEqual({ kind: "bullet", text: "Plain" });
    expect(toggleNoteLine(body, 1)).toBe("Intro\n- [x] Buy paper\n- Plain bullet");
    expect(toggleNoteLine(toggleNoteLine(body, 1), 1)).toBe(body);
  });

  it("allows only http and https links", () => {
    expect(resourceInputSchema.safeParse({ name: "a", url: "https://example.test" }).success).toBe(true);
    expect(resourceInputSchema.safeParse({ name: "a", url: "javascript:alert(1)" }).success).toBe(false);
    expect(resourceInputSchema.safeParse({ name: "a", url: "ftp://example.test" }).success).toBe(false);
  });

  it("validates check-in forms", () => {
    expect(progressInputSchema.safeParse({ task_id: null, completed_text: "", next_text: "" }).success).toBe(false);
    expect(progressInputSchema.safeParse({ task_id: null, completed_text: "", next_text: "Finish" }).success).toBe(true);
    expect(helpInputSchema.safeParse({ task_id: null, blocking: "x", support: "" }).success).toBe(false);
  });

  it("reports step progress", () => {
    expect(stepProgressLabel(2, 5)).toBe("2 of 5 steps completed");
    expect(stepProgressLabel(0, 0)).toBe("Add your first step");
  });
});
