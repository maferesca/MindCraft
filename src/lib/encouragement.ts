// A small local collection, so these never need an AI request. They encourage the
// next step without guilt, comparison, or assumptions about how anyone feels.
export const DAILY_PHRASES = [
  "Start with one manageable step.",
  "One clear step is enough to begin.",
  "Small steps still count.",
  "Pick the next thing, not everything.",
  "A rough start is still a start.",
  "You can adjust the plan as you go.",
  "Begin where it is easiest.",
  "Take the next step at your own pace.",
  "A short session is a good session.",
  "Progress can be quiet.",
  "Your workspace, your pace.",
] as const;

export const TASK_COMPLETED_MESSAGE = "Task completed. Your progress is saved.";
export const SESSION_FINISHED_MESSAGE = "Session finished. Take a moment before your next step.";

// The same phrase for the whole local day.
export function dailyPhrase(date: string) {
  const sum = [...date].reduce((total, character) => total + character.charCodeAt(0), 0);
  return DAILY_PHRASES[sum % DAILY_PHRASES.length];
}
