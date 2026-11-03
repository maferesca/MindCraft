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
