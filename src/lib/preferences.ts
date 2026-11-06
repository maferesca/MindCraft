import { z } from "zod";
import { THEMES, THEME_IDS, resolveTokens, type AccentId, type ThemeId } from "./themes";

export const BLOCK_TYPES = ["task_list", "calendar", "next_step", "focus_timer", "notes", "resources", "check_in"] as const;

// A running timer is stored as timestamps, so refreshing or switching tabs never slows it.
export const timerSessionSchema = z.object({
  mode: z.enum(["countdown", "stopwatch"]),
  phase: z.enum(["work", "break"]),
  runState: z.enum(["idle", "running", "paused", "finished"]),
  startedAt: z.number().nullable(),
  accumulatedMs: z.number().min(0),
  targetMs: z.number().min(0),
  endedBy: z.enum(["user", "zero"]).nullable(),
  taskId: z.string().uuid().nullable(),
});
export type TimerSession = z.infer<typeof timerSessionSchema>;

export const FONT_OPTIONS = {
  system: { label: "System default", stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  verdana: { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  "open-sans": { label: "Open Sans", stack: 'var(--font-open-sans), "Open Sans", Arial, sans-serif' },
  lexend: { label: "Lexend", stack: "var(--font-lexend), Verdana, sans-serif" },
  atkinson: { label: "Atkinson Hyperlegible", stack: "var(--font-atkinson), Verdana, sans-serif" },
  "comic-neue": { label: "Comic Neue", stack: 'var(--font-comic-neue), "Comic Sans MS", sans-serif' },
  opendyslexic: { label: "OpenDyslexic", stack: "var(--font-opendyslexic), Verdana, sans-serif" },
} as const;

export const START_HELP_LABELS = {
  clear_steps: "Clear steps",
  examples: "An example to follow",
  time_limit: "A time limit",
  knowing_why: "Knowing why it matters",
  quick_win: "Starting with something quick",
} as const;
const START_HELP_OPTIONS = Object.keys(START_HELP_LABELS) as [keyof typeof START_HELP_LABELS, ...Array<keyof typeof START_HELP_LABELS>];

// Saved as planningStyle, so choices made before these names existed keep working.
export const ASSISTANCE_LEVELS = {
  one_step: { label: "Quick Start", description: "One clear next step, and nothing more until it is done." },
  short_list: { label: "Guided", description: "Three to five clear steps to follow in order." },
  full_overview: { label: "Detailed", description: "Very small, explicit steps, shown a few at a time." },
} as const;

export const COMMUNICATION_STYLES = {
  supportive: { label: "Supportive", description: "Friendly, encouraging, and patient." },
  direct: { label: "Direct", description: "Short, specific, and action-oriented." },
  neutral: { label: "Neutral", description: "Clear, factual, and minimal." },
} as const;

export const preferencesSchema = z.object({
  theme: z.enum(THEME_IDS),
  accent: z.enum(["theme", "terracotta", "sage", "ocean", "plum", "graphite"]),
  fontFamily: z.enum(["system", "arial", "verdana", "open-sans", "lexend", "atkinson", "comic-neue", "opendyslexic"]),
  textSize: z.number().int().min(14).max(24),
  lineHeight: z.number().min(1.3).max(2.2),
  letterSpacing: z.number().min(0).max(0.08),
  wordSpacing: z.number().min(0).max(0.3),
  density: z.enum(["compact", "comfortable", "spacious"]),
  reducedMotion: z.enum(["system", "on", "off"]),
  sounds: z.boolean(),
  preferredTools: z.array(z.enum(BLOCK_TYPES)).max(7),
  responseDetail: z.enum(["brief", "balanced", "detailed"]),
  language: z.string().max(40),
  planningStyle: z.enum(["one_step", "short_list", "full_overview"]),
  communicationStyle: z.enum(["supportive", "direct", "neutral"]),
  stepLayout: z.enum(["list", "visual"]),
  // A voice from this browser. Empty means the best one for the text's language.
  speechVoice: z.string().max(300),
  workspaceGuideSeen: z.boolean(),
  taskPresentation: z.enum(["not_set", "checklist", "short_text"]),
  focusTime: z.enum(["not_set", "morning", "afternoon", "evening", "varies"]),
  startHelp: z.array(z.enum(START_HELP_OPTIONS)).max(5),
  workMinutes: z.number().int().min(1).max(600),
  breakMinutes: z.number().int().min(1).max(120),
  // The session used when no timer block is involved, as in Focus Mode.
  timer: timerSessionSchema,
  // Sessions of timer blocks, by block id. Only one runs at a time.
  timerSessions: z.record(z.string(), timerSessionSchema),
  activeTimerId: z.string().nullable(),
  motivationalMessages: z.boolean(),
  rewardsEnabled: z.boolean(),
  xpNotifications: z.boolean(),
  levelUpMessages: z.boolean(),
  showStreak: z.boolean(),
  dailyWelcome: z.boolean(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "warm-studio",
  accent: "theme",
  fontFamily: "lexend",
  textSize: 16,
  lineHeight: 1.6,
  letterSpacing: 0,
  wordSpacing: 0,
  density: "comfortable",
  reducedMotion: "system",
  sounds: false,
  preferredTools: [],
  responseDetail: "brief",
  language: "auto",
  planningStyle: "short_list",
  communicationStyle: "supportive",
  stepLayout: "list",
  speechVoice: "",
  workspaceGuideSeen: false,
  taskPresentation: "not_set",
  focusTime: "not_set",
  startHelp: [],
  workMinutes: 25,
  breakMinutes: 5,
  timer: { mode: "countdown", phase: "work", runState: "idle", startedAt: null, accumulatedMs: 0, targetMs: 0, endedBy: null, taskId: null },
  timerSessions: {},
  activeTimerId: null,
  motivationalMessages: true,
  rewardsEnabled: true,
  xpNotifications: true,
  levelUpMessages: true,
  showStreak: true,
  dailyWelcome: true,
};

// Merges stored settings with defaults, dropping any invalid value so a bad
// field never breaks the whole preference set.
export function normalizePreferences(stored: unknown): Preferences {
  const source = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  const result: Record<string, unknown> = { ...DEFAULT_PREFERENCES };
  for (const key of Object.keys(DEFAULT_PREFERENCES) as Array<keyof Preferences>) {
    if (!(key in source)) continue;
    const parsed = preferencesSchema.shape[key].safeParse(source[key]);
    if (parsed.success) result[key] = parsed.data;
  }
  return result as Preferences;
}

const DENSITY_SCALE: Record<Preferences["density"], number> = {
  compact: 0.8,
  comfortable: 1,
  spacious: 1.25,
};

// Converts preferences into CSS custom properties applied on <html>.
export function preferenceStyleVariables(preferences: Preferences): Record<string, string> {
  const tokens = resolveTokens(preferences.theme as ThemeId, preferences.accent as AccentId);
  const variables: Record<string, string> = {
    "--font-body": FONT_OPTIONS[preferences.fontFamily].stack,
    "--text-base": `${preferences.textSize}px`,
    "--line-height": String(preferences.lineHeight),
    "--letter-spacing": `${preferences.letterSpacing}em`,
    "--word-spacing": `${preferences.wordSpacing}em`,
    "--density": String(DENSITY_SCALE[preferences.density]),
  };
  for (const [name, value] of Object.entries(tokens)) {
    variables[`--mc-${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`] = value;
  }
  return variables;
}

export function applyPreferencesToDocument(preferences: Preferences) {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(preferenceStyleVariables(preferences))) {
    root.style.setProperty(name, value);
  }
  root.dataset.theme = preferences.theme;
  root.dataset.motion = preferences.reducedMotion;
  root.style.colorScheme = THEMES[preferences.theme].dark ? "dark" : "light";
  // Font size on <html> scales every rem-based size, including dialogs and chat.
  root.style.fontSize = `${preferences.textSize}px`;
}

// Shows a saved value by its visible name wherever one exists.
export function preferenceValueLabel(key: string, value: unknown) {
  if (key === "planningStyle") return ASSISTANCE_LEVELS[value as Preferences["planningStyle"]]?.label ?? String(value);
  if (key === "communicationStyle") return COMMUNICATION_STYLES[value as Preferences["communicationStyle"]]?.label ?? String(value);
  return String(value);
}

export const PREFERENCE_LABELS: Partial<Record<keyof Preferences, string>> = {
  theme: "Theme",
  accent: "Accent color",
  fontFamily: "Font",
  textSize: "Text size",
  lineHeight: "Line spacing",
  letterSpacing: "Letter spacing",
  wordSpacing: "Word spacing",
  density: "Information density",
  reducedMotion: "Motion",
  sounds: "Sounds",
  responseDetail: "Assistant response detail",
  planningStyle: "Assistance level",
  communicationStyle: "Communication style",
  taskPresentation: "How the assistant presents tasks",
  workMinutes: "Work session length in minutes",
};
