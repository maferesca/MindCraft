// The streak flame changes color as the days add up. Each stage has a color for light
// themes and one for dark themes, so it stays visible on every theme's surface.
export const STREAK_STAGES = [
  { days: 1, name: "Orange", light: "#C2410C", dark: "#FF922B" },
  { days: 3, name: "Red", light: "#C92A2A", dark: "#FF8787" },
  { days: 7, name: "Pink", light: "#C2255C", dark: "#FAA2C1" },
  { days: 14, name: "Purple", light: "#7B2CBF", dark: "#D0A2FF" },
  { days: 30, name: "Blue", light: "#1864AB", dark: "#74C0FC" },
  { days: 100, name: "Gold", light: "#8A6100", dark: "#FFD43B" },
] as const;

export function streakStage(days: number) {
  const index = STREAK_STAGES.reduce((found, stage, position) => (days >= stage.days ? position : found), 0);
  return { stage: STREAK_STAGES[index], next: STREAK_STAGES[index + 1] ?? null };
}
