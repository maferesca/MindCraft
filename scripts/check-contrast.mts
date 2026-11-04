// Measures WCAG contrast ratios for every theme and accent combination.
// Usage: npm run check:contrast
// Text pairs need 4.5:1; control boundaries and focus indicators need 3:1.

import { ACCENTS, THEMES, resolveTokens, type AccentId, type ThemeId, type ThemeTokens } from "../src/lib/themes.ts";

function luminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((index) => parseInt(value.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Same result as CSS color-mix(in srgb, color percent, base).
function mix(color: string, base: string, percent: number): string {
  const channel = (hex: string, index: number) => parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
  const mixed = [0, 1, 2].map((index) => Math.round(channel(color, index) * percent + channel(base, index) * (1 - percent)));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

// Color vision simulation (Machado, Oliveira & Fernandes 2009, severity 1.0), applied in linear RGB.
const COLOR_VISION = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};

function simulate(hex: string, matrix: number[][]): string {
  const linear = [1, 3, 5].map((start) => {
    const c = parseInt(hex.slice(start, start + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const channels = matrix.map((row) => {
    const value = Math.min(1, Math.max(0, row[0] * linear[0] + row[1] * linear[1] + row[2] * linear[2]));
    const encoded = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055;
    return Math.round(encoded * 255).toString(16).padStart(2, "0");
  });
  return `#${channels.join("")}`;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const checks: Array<[keyof ThemeTokens, keyof ThemeTokens, number]> = [
  ["text", "background", 4.5],
  ["text", "surface", 4.5],
  ["text", "surfaceMuted", 4.5],
  ["textMuted", "background", 4.5],
  ["textMuted", "surface", 4.5],
  ["textMuted", "surfaceMuted", 4.5],
  ["onPrimary", "primary", 4.5],
  ["primary", "surface", 4.5],
  ["primary", "background", 4.5],
  ["text", "primarySoft", 4.5],
  ["primary", "primarySoft", 4.5],
  ["secondary", "surface", 4.5],
  ["danger", "surface", 4.5],
  ["borderStrong", "surface", 3],
  ["borderStrong", "background", 3],
  ["focus", "surface", 3],
  ["focus", "background", 3],
];

let failures = 0;
const accents: AccentId[] = ["theme", ...(Object.keys(ACCENTS) as AccentId[])];

for (const themeId of Object.keys(THEMES) as ThemeId[]) {
  for (const accentId of accents) {
    const tokens = resolveTokens(themeId, accentId);
    for (const [foreground, background, minimum] of checks) {
      const ratio = contrast(tokens[foreground], tokens[background]);
      if (ratio < minimum) {
        failures += 1;
        console.log(`FAIL ${themeId}/${accentId}: ${foreground} on ${background} = ${ratio.toFixed(2)} (needs ${minimum})`);
      }
    }
    // Text and controls must stay readable under simulated color vision deficiency.
    for (const [condition, matrix] of Object.entries(COLOR_VISION)) {
      for (const [foreground, background, minimum] of checks) {
        const ratio = contrast(simulate(tokens[foreground], matrix), simulate(tokens[background], matrix));
        if (ratio < minimum) {
          failures += 1;
          console.log(`FAIL ${themeId}/${accentId} (${condition}): ${foreground} on ${background} = ${ratio.toFixed(2)} (needs ${minimum})`);
        }
      }
    }
    // Block headers: text sits on the cube color mixed into the surface.
    for (const cube of ["cubeA", "cubeB", "cubeC"] as const) {
      const header = mix(tokens[cube], tokens.surface, parseFloat(tokens.blockTint) / 100);
      const ratio = contrast(tokens.text, header);
      if (ratio < 4.5) {
        failures += 1;
        console.log(`FAIL ${themeId}/${accentId}: text on ${cube} block header = ${ratio.toFixed(2)} (needs 4.5)`);
      }
    }
  }
  const base = THEMES[themeId].tokens;
  console.log(
    `${THEMES[themeId].label.padEnd(19)} text ${contrast(base.text, base.surface).toFixed(1)}:1, ` +
      `muted ${contrast(base.textMuted, base.surface).toFixed(1)}:1, ` +
      `button ${contrast(base.onPrimary, base.primary).toFixed(1)}:1, ` +
      `control border ${contrast(base.borderStrong, base.surface).toFixed(1)}:1`,
  );
}

console.log(failures === 0 ? "\nAll contrast checks passed." : `\n${failures} contrast check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
