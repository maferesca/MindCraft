import { z } from "zod";
import { resolveTokens, type AccentId, type ThemeId } from "./themes";

export const BLOCK_TYPES = ["task_list", "calendar", "next_step", "focus_timer", "notes"] as const;

export const FONT_OPTIONS = {
  system: { label: "System default", stack: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  arial: { label: "Arial", stack: "Arial, Helvetica, sans-serif" },
  verdana: { label: "Verdana", stack: "Verdana, Geneva, sans-serif" },
  "open-sans": { label: "Open Sans", stack: 'var(--font-open-sans), "Open Sans", Arial, sans-serif' },
} as const;

export const preferencesSchema = z.object({
  theme: z.enum(["warm-studio", "clear", "rose", "colorful", "monochrome", "dark"]),
  accent: z.enum(["theme", "terracotta", "sage", "ocean", "plum", "graphite"]),
  fontFamily: z.enum(["system", "arial", "verdana", "open-sans"]),
  textSize: z.number().int().min(14).max(24),
  lineHeight: z.number().min(1.3).max(2.2),
  letterSpacing: z.number().min(0).max(0.08),
  density: z.enum(["compact", "comfortable", "spacious"]),
  reducedMotion: z.enum(["system", "on", "off"]),
  sounds: z.boolean(),
  preferredTools: z.array(z.enum(BLOCK_TYPES)).max(5),
  responseDetail: z.enum(["brief", "balanced", "detailed"]),
  language: z.string().max(40),
  planningStyle: z.enum(["one_step", "short_list", "full_overview"]),
  workMinutes: z.number().int().min(5).max(120),
  breakMinutes: z.number().int().min(1).max(60),
  showStreak: z.boolean(),
  dailyWelcome: z.boolean(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export const DEFAULT_PREFERENCES: Preferences = {
  theme: "warm-studio",
  accent: "theme",
  fontFamily: "system",
  textSize: 16,
  lineHeight: 1.6,
  letterSpacing: 0,
  density: "comfortable",
  reducedMotion: "system",
  sounds: false,
  preferredTools: [],
  responseDetail: "brief",
  language: "auto",
  planningStyle: "short_list",
  workMinutes: 25,
  breakMinutes: 5,
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
  root.style.colorScheme = preferences.theme === "dark" ? "dark" : "light";
  // Font size on <html> scales every rem-based size, including dialogs and chat.
  root.style.fontSize = `${preferences.textSize}px`;
}

export const PREFERENCE_LABELS: Partial<Record<keyof Preferences, string>> = {
  theme: "Theme",
  accent: "Accent color",
  fontFamily: "Font",
  textSize: "Text size",
  lineHeight: "Line spacing",
  letterSpacing: "Letter spacing",
  density: "Information density",
  reducedMotion: "Motion",
  sounds: "Sounds",
  responseDetail: "Assistant response detail",
};
