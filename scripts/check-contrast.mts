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
  }
  const base = THEMES[themeId].tokens;
  console.log(
    `${THEMES[themeId].label.padEnd(12)} text ${contrast(base.text, base.surface).toFixed(1)}:1, ` +
      `muted ${contrast(base.textMuted, base.surface).toFixed(1)}:1, ` +
      `button ${contrast(base.onPrimary, base.primary).toFixed(1)}:1, ` +
      `control border ${contrast(base.borderStrong, base.surface).toFixed(1)}:1`,
  );
}

console.log(failures === 0 ? "\nAll contrast checks passed." : `\n${failures} contrast check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
