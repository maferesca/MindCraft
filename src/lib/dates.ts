import type { Streak } from "./types";

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

// Returns yyyy-MM-dd for the given instant in the given IANA timezone.
export function localDateString(timezone: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
  } catch {
    return at.toISOString().slice(0, 10);
  }
}

export function addDaysToDateString(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return value.toISOString().slice(0, 10);
}

// Same rule as the record_workspace_visit SQL function: at most one
// qualifying visit per local day; consecutive days extend the streak.
export function nextStreak(previous: Streak | null, today: string): Streak {
  if (!previous || !previous.last_visit_date) {
    return { current_streak: 1, best_streak: Math.max(1, previous?.best_streak ?? 0), last_visit_date: today };
  }
  if (previous.last_visit_date === today) return previous;
  const continues = addDaysToDateString(previous.last_visit_date, 1) === today;
  const current = continues ? previous.current_streak + 1 : 1;
  return { current_streak: current, best_streak: Math.max(previous.best_streak, current), last_visit_date: today };
}

// The wall-clock date and time of an instant in a timezone.
export function zonedParts(instant: string | Date, timezone: string): { date: string; time: string } {
  const at = new Date(instant);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(at);
  return { date: localDateString(timezone, at), time: time.startsWith("24") ? `00${time.slice(2)}` : time };
}

function timezoneOffsetMs(utcMs: number, timezone: string) {
  const { date, time } = zonedParts(new Date(utcMs), timezone);
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return Date.UTC(year, month - 1, day, hours, minutes) - Math.floor(utcMs / 60_000) * 60_000;
}

// The instant for a wall-clock date and time in a timezone. The offset is checked
// twice because the first guess can land on the other side of a clock change.
export function zonedToIso(date: string, time: string, timezone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const wallClock = Date.UTC(year, month - 1, day, hours, minutes);
  let utc = wallClock - timezoneOffsetMs(wallClock, timezone);
  utc = wallClock - timezoneOffsetMs(utc, timezone);
  return new Date(utc).toISOString();
}

// 0 is Sunday. Works on the calendar date alone, independent of any timezone.
export function weekdayOf(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfWeekDate(date: string, firstDay: 0 | 1) {
  return addDaysToDateString(date, -((weekdayOf(date) - firstDay + 7) % 7));
}

export function dateRange(start: string, count: number) {
  return Array.from({ length: count }, (_, index) => addDaysToDateString(start, index));
}

export function daysInMonth(date: string) {
  const [year, month] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addMonthsToDateString(date: string, months: number) {
  const [year, month, day] = date.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1)).toISOString().slice(0, 10);
  return `${first.slice(0, 8)}${String(Math.min(day, daysInMonth(first))).padStart(2, "0")}`;
}

// Minutes since midnight for "HH:mm" or "HH:mm:ss".
export function minutesFromTime(value: string | null): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

export function isWithinQuietHours(start: string | null, end: string | null, now: Date, timezone: string): boolean {
  const startMinutes = minutesFromTime(start);
  const endMinutes = minutesFromTime(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(now)
    .split(":")
    .map(Number);
  const current = (parts[0] % 24) * 60 + parts[1];
  return startMinutes < endMinutes
    ? current >= startMinutes && current < endMinutes
    : current >= startMinutes || current < endMinutes;
}
