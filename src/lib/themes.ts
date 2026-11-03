// Theme and accent definitions. Kept free of imports so scripts/check-contrast.ts
// can load this file directly with Node and measure the real contrast ratios.

export interface ThemeTokens {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  primarySoft: string;
  secondary: string;
  border: string;
  // Used where a boundary identifies a control (inputs, checkboxes); needs 3:1.
  borderStrong: string;
  focus: string;
  danger: string;
  // Decorative cube colors for brand and inventory icons. Never used for text.
  cubeA: string;
  cubeB: string;
  cubeC: string;
}

export type ThemeId = "warm-studio" | "clear" | "rose" | "colorful" | "monochrome" | "dark";

export const THEMES: Record<ThemeId, { label: string; dark: boolean; tokens: ThemeTokens }> = {
  "warm-studio": {
    label: "Warm Studio",
    dark: false,
    tokens: {
      background: "#F7F2EA",
      surface: "#FFFCF7",
      surfaceMuted: "#F1E9DE",
      text: "#30261F",
      textMuted: "#66574B",
      primary: "#8F432F",
      onPrimary: "#FFFFFF",
      primarySoft: "#F1DED3",
      secondary: "#586B50",
      border: "#D9CEC1",
      borderStrong: "#857261",
      focus: "#1F4E8C",
      danger: "#9E2F25",
      cubeA: "#C8714F",
      cubeB: "#8FA383",
      cubeC: "#E3B66B",
    },
  },
  clear: {
    label: "Clear",
    dark: false,
    tokens: {
      background: "#F6F7F9",
      surface: "#FFFFFF",
      surfaceMuted: "#EEF0F3",
      text: "#1D232B",
      textMuted: "#535C68",
      primary: "#2F5C8F",
      onPrimary: "#FFFFFF",
      primarySoft: "#E3ECF6",
      secondary: "#466556",
      border: "#DDE1E6",
      borderStrong: "#7D8693",
      focus: "#1D4ED8",
      danger: "#A32A22",
      cubeA: "#7FA3CC",
      cubeB: "#A8B9A9",
      cubeC: "#C9CFD8",
    },
  },
  rose: {
    label: "Rose",
    dark: false,
    tokens: {
      background: "#FBF3F4",
      surface: "#FFFAFA",
      surfaceMuted: "#F6E6E9",
      text: "#3A2028",
      textMuted: "#6E4B55",
      primary: "#8C2449",
      onPrimary: "#FFFFFF",
      primarySoft: "#F7DCE5",
      secondary: "#6B4C7A",
      border: "#EBD3D9",
      borderStrong: "#9A7480",
      focus: "#5A1F8C",
      danger: "#9E2F25",
      cubeA: "#D98AA5",
      cubeB: "#B7A0C7",
      cubeC: "#F0C2B4",
    },
  },
  colorful: {
    label: "Colorful",
    dark: false,
    tokens: {
      background: "#F7F6F2",
      surface: "#FFFFFF",
      surfaceMuted: "#EFEDE6",
      text: "#24242A",
      textMuted: "#55555F",
      primary: "#1F6E8C",
      onPrimary: "#FFFFFF",
      primarySoft: "#DDF0F6",
      secondary: "#6E45A3",
      border: "#DEDBD2",
      borderStrong: "#85827A",
      focus: "#B4410C",
      danger: "#A32A22",
      cubeA: "#E8A33D",
      cubeB: "#4C9F70",
      cubeC: "#5B7FD6",
    },
  },
  monochrome: {
    label: "Monochrome",
    dark: false,
    tokens: {
      background: "#F5F5F5",
      surface: "#FFFFFF",
      surfaceMuted: "#EBEBEB",
      text: "#111111",
      textMuted: "#4A4A4A",
      primary: "#1A1A1A",
      onPrimary: "#FFFFFF",
      primarySoft: "#E3E3E3",
      secondary: "#3D3D3D",
      border: "#D4D4D4",
      borderStrong: "#767676",
      focus: "#000000",
      danger: "#8A1C1C",
      cubeA: "#9A9A9A",
      cubeB: "#C4C4C4",
      cubeC: "#6E6E6E",
    },
  },
  dark: {
    label: "Dark",
    dark: true,
    tokens: {
      background: "#1E1A17",
      surface: "#2A2420",
      surfaceMuted: "#352E29",
      text: "#F2EAE1",
      textMuted: "#C7BAAD",
      primary: "#EBAA93",
      onPrimary: "#2A1710",
      primarySoft: "#4A3129",
      secondary: "#AFC4A4",
      border: "#4A403A",
      borderStrong: "#988A7F",
      focus: "#F3C77A",
      danger: "#F4A397",
      cubeA: "#B8664A",
      cubeB: "#7C9070",
      cubeC: "#C99D57",
    },
  },
};

export type AccentId = "theme" | "terracotta" | "sage" | "ocean" | "plum" | "graphite";

type AccentTokens = Pick<ThemeTokens, "primary" | "onPrimary" | "primarySoft">;

// Each accent has a variant for light and dark themes so contrast holds in both.
export const ACCENTS: Record<Exclude<AccentId, "theme">, { label: string; light: AccentTokens; dark: AccentTokens }> = {
  terracotta: {
    label: "Terracotta",
    light: { primary: "#8F432F", onPrimary: "#FFFFFF", primarySoft: "#F1DED3" },
    dark: { primary: "#EBAA93", onPrimary: "#2A1710", primarySoft: "#4A3129" },
  },
  sage: {
    label: "Sage",
    light: { primary: "#4A5E43", onPrimary: "#FFFFFF", primarySoft: "#E1E9DC" },
    dark: { primary: "#B5CBA9", onPrimary: "#1B2417", primarySoft: "#36422F" },
  },
  ocean: {
    label: "Ocean",
    light: { primary: "#235C86", onPrimary: "#FFFFFF", primarySoft: "#DDEAF4" },
    dark: { primary: "#9CC7E8", onPrimary: "#0F2333", primarySoft: "#253A4B" },
  },
  plum: {
    label: "Plum",
    light: { primary: "#6A3577", onPrimary: "#FFFFFF", primarySoft: "#EEDFF2" },
    dark: { primary: "#D7B2E2", onPrimary: "#2A1530", primarySoft: "#43304A" },
  },
  graphite: {
    label: "Graphite",
    light: { primary: "#333A40", onPrimary: "#FFFFFF", primarySoft: "#E3E6E8" },
    dark: { primary: "#D2D8DD", onPrimary: "#1A1E22", primarySoft: "#3A4046" },
  },
};

export function resolveTokens(themeId: ThemeId, accentId: AccentId): ThemeTokens {
  const theme = THEMES[themeId] ?? THEMES["warm-studio"];
  if (accentId === "theme" || !ACCENTS[accentId]) return theme.tokens;
  const accent = ACCENTS[accentId][theme.dark ? "dark" : "light"];
  return { ...theme.tokens, ...accent };
}
