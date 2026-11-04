"use client";

import { Check, Eye, RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { DEFAULT_PREFERENCES, FONT_OPTIONS, type Preferences } from "@/lib/preferences";
import { ACCENTS, THEMES, resolveTokens, type ThemeId } from "@/lib/themes";

type Field = "theme" | "accent" | "fontFamily" | "textSize" | "lineHeight" | "letterSpacing" | "wordSpacing" | "density" | "reducedMotion" | "sounds";

interface AppearanceFieldsProps {
  value: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  fields?: Field[];
}

const ALL_FIELDS: Field[] = ["theme", "accent", "fontFamily", "textSize", "lineHeight", "letterSpacing", "wordSpacing", "density", "reducedMotion", "sounds"];

// Shared appearance controls for onboarding and settings. Each setting has
// its own "Reset" so people can undo one choice without losing the others.
export function AppearanceFields({ value, onChange, fields = ALL_FIELDS }: AppearanceFieldsProps) {
  const show = (field: Field) => fields.includes(field);
  const reset = (field: Field) => onChange({ [field]: DEFAULT_PREFERENCES[field] } as Partial<Preferences>);
  const isDefault = (field: Field) => value[field] === DEFAULT_PREFERENCES[field];

  return (
    <div className="flex flex-col gap-5">
      {show("theme") ? (
        <SettingRow
          label="Theme"
          hint="Blue & Orange stays clear with most types of color blindness."
          onReset={() => reset("theme")}
          isDefault={isDefault("theme")}
        >
          <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-1.5">
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
                  className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2 text-sm ${selected ? "border-primary font-semibold" : "border-border"}`}
                >
                  <span aria-hidden="true" className="flex h-5 w-7 shrink-0 items-center justify-center gap-0.5 overflow-hidden rounded-full border" style={{ background: tokens.background, borderColor: tokens.border }}>
                                        <span className="h-3 w-1.5 rounded-sm" style={{ background: tokens.primary }} />
                    <span className="h-3 w-1.5 rounded-sm" style={{ background: tokens.secondary }} />
                  </span>
                  {THEMES[id].label}
                  <SelectedMark selected={selected} />
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
                  className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 text-sm ${selected ? "border-primary font-semibold" : "border-border"}`}
                >
                  <span aria-hidden="true" className="h-4 w-4 rounded-full" style={{ background: color }} />
                  {id === "theme" ? "Theme default" : ACCENTS[id as keyof typeof ACCENTS].label}
                  <SelectedMark selected={selected} />
                </button>
              );
            })}
          </div>
        </SettingRow>
      ) : null}

      {show("fontFamily") ? (
        <SettingRow
          label="Font"
          hint="Some people find Lexend, Atkinson, Comic Neue, or OpenDyslexic easier to read."
          onReset={() => reset("fontFamily")}
          isDefault={isDefault("fontFamily")}
        >
          <div role="radiogroup" aria-label="Font" className="flex flex-wrap gap-1.5">
            {(Object.keys(FONT_OPTIONS) as Preferences["fontFamily"][]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={value.fontFamily === id}
                onClick={() => onChange({ fontFamily: id })}
                className={`inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-full border-2 px-2.5 text-sm ${value.fontFamily === id ? "border-primary font-semibold" : "border-border"}`}
                style={{ fontFamily: FONT_OPTIONS[id].stack }}
              >
                {FONT_OPTIONS[id].label}
                <SelectedMark selected={value.fontFamily === id} />
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

      {show("wordSpacing") ? (
        <SettingRow label="Word spacing" onReset={() => reset("wordSpacing")} isDefault={isDefault("wordSpacing")}>
          <Segmented
            label="Word spacing"
            value={String(value.wordSpacing)}
            options={[["0", "Normal"], ["0.1", "A little wider"], ["0.2", "Wider"]]}
            onChange={(next) => onChange({ wordSpacing: Number(next) })}
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

// Selection is shown with a check mark as well as the colored border.
function SelectedMark({ selected }: { selected: boolean }) {
  if (!selected) return null;
  return (
    <>
      <Check size={18} strokeWidth={3} aria-hidden="true" className="shrink-0 text-primary" />
      <span className="sr-only">(selected)</span>
    </>
  );
}

function SettingRow({ label, hint, children, onReset, isDefault }: { label: string; hint?: string; children: ReactNode; onReset: () => void; isDefault: boolean }) {
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
      {hint ? <p className="mc-hint mb-2">{hint}</p> : null}
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
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-3 ${value === optionValue ? "border-primary bg-primary-soft font-semibold" : "border-border"}`}
        >
          {optionLabel}
          <SelectedMark selected={value === optionValue} />
        </button>
      ))}
    </div>
  );
}

// Same sample content everywhere, so changes are easy to compare. The frame and
// neutral labels make clear this is a sample; `inert` removes it from clicks and
// keyboard focus, so nothing here can be mistaken for a real task or action.
export function AppearancePreview() {
  return (
    <div role="group" aria-labelledby="appearance-preview-title" className="rounded-2xl border-2 border-dashed border-border-strong bg-surface-muted p-3">
      <p id="appearance-preview-title" className="mb-3 flex items-center gap-2 font-bold">
        <Eye size={18} aria-hidden="true" /> Preview only
      </p>
      <div inert className="mc-card flex cursor-default select-none flex-col gap-3 p-[var(--space)]">
        <h3 className="text-lg font-bold">Sample heading</h3>
        <p>This is how text will look across Mindcraft.</p>
        <div className="flex flex-wrap gap-1.5">
          <span className="mc-chip">Sample label</span>
          <span className="mc-chip">Sample date</span>
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-5 w-5" defaultChecked />
          <span>Sample checklist item</span>
        </label>
        <div className="self-start rounded-2xl border border-border bg-background px-3 py-2">Sample assistant message</div>
        <div className="flex flex-wrap gap-2">
          <span className="mc-btn mc-btn-primary mc-btn-sm">Main button</span>
          <span className="mc-btn mc-btn-secondary mc-btn-sm">Other button</span>
        </div>
      </div>
    </div>
  );
}
