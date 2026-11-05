// Small local collections, so these never need an AI request. They encourage the
// next step without guilt, comparison, or assumptions about how anyone feels.
export const DAILY_PHRASES = [
  "Start with one manageable step.",
  "You can adjust your plan as you go.",
  "Make room for the way you work.",
  "One clear step is enough to begin.",
  "Pick the next thing, not everything.",
  "A rough start is still a start.",
  "Begin where it is easiest.",
  "Take the next step at your own pace.",
  "A short session is a good session.",
  "Your workspace, your pace.",
] as const;

export const TASK_PHRASES = [
  "One more task completed.",
  "That step is done. Choose what comes next.",
  "Take a moment to acknowledge your progress.",
] as const;

export const SESSION_PHRASES = [
  "Session finished. Take a moment before your next step.",
  "Your planned focus time is complete.",
] as const;

// Several completions in a row get one message, so nobody is interrupted repeatedly.
export const ENCOURAGEMENT_COOLDOWN_MS = 30_000;

export type EncouragementKind = "task" | "session";

// Counting days means two days in a row can never land on the same phrase, even
// across a month or a year. The date is the person's local calendar date.
function dayNumber(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function dailyPhrase(date: string) {
  return DAILY_PHRASES[dayNumber(date) % DAILY_PHRASES.length];
}

// Decides whether a message may show now, and which one. Each kind takes turns
// through its own phrases, and the waiting time is shared by both kinds.
export function createEncouragementPicker() {
  const used: Record<EncouragementKind, number> = { task: 0, session: 0 };
  let lastShownAt = Number.NEGATIVE_INFINITY;

  return {
    next(kind: EncouragementKind, now: number): string | null {
      if (now - lastShownAt < ENCOURAGEMENT_COOLDOWN_MS) return null;
      lastShownAt = now;
      const phrases = kind === "task" ? TASK_PHRASES : SESSION_PHRASES;
      const phrase = phrases[used[kind] % phrases.length];
      used[kind] += 1;
      return phrase;
    },
  };
}
