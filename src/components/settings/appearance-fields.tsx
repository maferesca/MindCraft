"use client";

import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { DEFAULT_PREFERENCES, FONT_OPTIONS, type Preferences } from "@/lib/preferences";
import { ACCENTS, THEMES, resolveTokens, type ThemeId } from "@/lib/themes";

type Field = "theme" | "accent" | "fontFamily" | "textSize" | "lineHeight" | "letterSpacing" | "density" | "reducedMotion" | "sounds";

interface AppearanceFieldsProps {
  value: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  fields?: Field[];
}

const ALL_FIELDS: Field[] = ["theme", "accent", "fontFamily", "textSize", "lineHeight", "letterSpacing", "density", "reducedMotion", "sounds"];

// Shared appearance controls for onboarding and settings. Each setting has
// its own "Reset" so people can undo one choice without losing the others.
export function AppearanceFields({ value, onChange, fields = ALL_FIELDS }: AppearanceFieldsProps) {
  const show = (field: Field) => fields.includes(field);
  const reset = (field: Field) => onChange({ [field]: DEFAULT_PREFERENCES[field] } as Partial<Preferences>);
  const isDefault = (field: Field) => value[field] === DEFAULT_PREFERENCES[field];

  return (
    <div className="flex flex-col gap-5">
      {show("theme") ? (
        <SettingRow label="Theme" onReset={() => reset("theme")} isDefault={isDefault("theme")}>
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => {
              const tokens = THEMES[id].tokens;
              const selected = value.theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ theme: id })}
                  className={`flex items-center gap-2 rounded-xl border-2 p-2 text-left ${selected ? "border-primary" : "border-border"}`}
                >
                  <span aria-hidden="true" className="flex h-8 w-10 shrink-0 overflow-hidden rounded-md border" style={{ background: tokens.background, borderColor: tokens.border }}>
                    <span className="m-1 h-6 w-3 rounded-sm" style={{ background: tokens.surface }} />
                    <span className="my-2 h-4 w-3 rounded-sm" style={{ background: tokens.primary }} />
                  </span>
                  <span className="font-semibold">{THEMES[id].label}</span>
                  {selected ? <span className="sr-only">(selected)</span> : null}
                </button>
              );
            })}
          </div>
        </SettingRow>
      ) : null}

      {show("accent") ? (
        <SettingRow label="Accent color" onReset={() => reset("accent")} isDefault={isDefault("accent")}>
          <div role="radiogroup" aria-label="Accent color" className="flex flex-wrap gap-2">
            {(["theme", ...Object.keys(ACCENTS)] as Preferences["accent"][]).map((id) => {
              const color = resolveTokens(value.theme, id).primary;
              const selected = value.accent === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange({ accent: id })}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-3 ${selected ? "border-primary font-semibold" : "border-border"}`}
                >
                  <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ background: color }} />
                  {id === "theme" ? "Theme default" : ACCENTS[id as keyof typeof ACCENTS].label}
                </button>
              );
            })}
          </div>
        </SettingRow>
      ) : null}

      {show("fontFamily") ? (
        <SettingRow label="Font" onReset={() => reset("fontFamily")} isDefault={isDefault("fontFamily")}>
          <div role="radiogroup" aria-label="Font" className="grid grid-cols-2 gap-2">
            {(Object.keys(FONT_OPTIONS) as Preferences["fontFamily"][]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={value.fontFamily === id}
                onClick={() => onChange({ fontFamily: id })}
                className={`rounded-xl border-2 px-3 py-2 text-left ${value.fontFamily === id ? "border-primary" : "border-border"}`}
                style={{ fontFamily: FONT_OPTIONS[id].stack }}
              >
                {FONT_OPTIONS[id].label}
              </button>
            ))}
          </div>
        </SettingRow>
      ) : null}

      {show("textSize") ? (
        <SettingRow label={`Text size: ${value.textSize}px`} onReset={() => reset("textSize")} isDefault={isDefault("textSize")}>
          <input
            type="range"
            min={14}
            max={24}
            step={1}
            value={value.textSize}
            aria-label="Text size"
            aria-valuetext={`${value.textSize} pixels`}
            className="w-full accent-[var(--mc-primary)]"
            onChange={(event) => onChange({ textSize: Number(event.target.value) })}
          />
        </SettingRow>
      ) : null}

      {show("lineHeight") ? (
        <SettingRow label="Line spacing" onReset={() => reset("lineHeight")} isDefault={isDefault("lineHeight")}>
          <Segmented
            label="Line spacing"
            value={String(value.lineHeight)}
            options={[["1.4", "Snug"], ["1.6", "Standard"], ["1.8", "Relaxed"], ["2", "Loose"]]}
            onChange={(next) => onChange({ lineHeight: Number(next) })}
          />
        </SettingRow>
      ) : null}

      {show("letterSpacing") ? (
        <SettingRow label="Letter spacing" onReset={() => reset("letterSpacing")} isDefault={isDefault("letterSpacing")}>
          <Segmented
            label="Letter spacing"
            value={String(value.letterSpacing)}
            options={[["0", "Normal"], ["0.02", "A little wider"], ["0.05", "Wider"]]}
            onChange={(next) => onChange({ letterSpacing: Number(next) })}
          />
        </SettingRow>
      ) : null}

      {show("density") ? (
        <SettingRow label="Information density" onReset={() => reset("density")} isDefault={isDefault("density")}>
          <Segmented
            label="Information density"
            value={value.density}
            options={[["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]]}
            onChange={(next) => onChange({ density: next as Preferences["density"] })}
          />
        </SettingRow>
      ) : null}

      {show("reducedMotion") ? (
        <SettingRow label="Motion" onReset={() => reset("reducedMotion")} isDefault={isDefault("reducedMotion")}>
          <Segmented
            label="Motion"
            value={value.reducedMotion}
            options={[["system", "Follow my device"], ["on", "Reduce motion"], ["off", "Allow motion"]]}
            onChange={(next) => onChange({ reducedMotion: next as Preferences["reducedMotion"] })}
          />
        </SettingRow>
      ) : null}

      {show("sounds") ? (
        <SettingRow label="Sounds" onReset={() => reset("sounds")} isDefault={isDefault("sounds")}>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={value.sounds} onChange={(event) => onChange({ sounds: event.target.checked })} />
            Play a soft chime when a timer finishes
          </label>
        </SettingRow>
      ) : null}
    </div>
  );
}

function SettingRow({ label, children, onReset, isDefault }: { label: string; children: ReactNode; onReset: () => void; isDefault: boolean }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-semibold">{label}</span>
        {!isDefault ? (
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onReset} aria-label={`Reset ${label.split(":")[0]}`}>
            <RotateCcw size={14} aria-hidden="true" /> Reset
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function Segmented({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(([optionValue, optionLabel]) => (
        <button
          key={optionValue}
          type="button"
          role="radio"
          aria-checked={value === optionValue}
          onClick={() => onChange(optionValue)}
          className={`min-h-11 rounded-xl border-2 px-3 ${value === optionValue ? "border-primary bg-primary-soft font-semibold" : "border-border"}`}
        >
          {optionLabel}
        </button>
      ))}
    </div>
  );
}

// Same sample content everywhere, so changes are easy to compare.
export function AppearancePreview() {
  return (
    <div aria-label="Preview" role="group" className="mc-card flex flex-col gap-3 p-[var(--space)]">
      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Preview</p>
      <h3 className="text-lg font-bold">Prepare the team update</h3>
      <p>Collect three highlights from this week and write two short sentences about each.</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="mc-chip">In progress</span>
        <span className="mc-chip">Due Fri 8 Nov</span>
      </div>
      <label className="flex items-center gap-2">
        <input type="checkbox" className="h-5 w-5" defaultChecked readOnly tabIndex={-1} aria-hidden="true" />
        <span>Open last week&apos;s notes</span>
      </label>
      <div className="self-start rounded-2xl border border-border bg-background px-3 py-2">Would you like to split this into smaller steps?</div>
      <div className="flex gap-2">
        <span className="mc-btn mc-btn-primary mc-btn-sm" aria-hidden="true">
          Apply
        </span>
        <span className="mc-btn mc-btn-secondary mc-btn-sm" aria-hidden="true">
          Edit
        </span>
      </div>
    </div>
  );
}
