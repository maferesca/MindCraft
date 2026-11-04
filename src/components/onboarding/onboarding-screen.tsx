"use client";

import { useState } from "react";
import { BLOCK_DEFINITIONS, BLOCK_ORDER } from "@/lib/blocks";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import type { BlockType } from "@/lib/types";
import { Wordmark } from "../brand/brand-mark";
import { BlockTile } from "../blocks/block-icon";
import { AppProviders } from "../providers/app-providers";
import { useWorkspaceData } from "../providers/workspace-data";
import { AppearanceFields, AppearancePreview } from "../settings/appearance-fields";
import { TextField } from "../ui/field";

export function OnboardingScreen() {
  return (
    <AppProviders>
      <Onboarding />
    </AppProviders>
  );
}

const STEPS = ["Your name", "Theme", "Reading", "Density", "Tools", "Reminders"] as const;

// Short, skippable setup. Explicit choices are stored directly; nothing about
// health, diagnosis, or personality is asked. Every step can be skipped.
function Onboarding() {
  const { profile, preferences, updatePreferences, updateProfile, updateNotificationPreferences, notificationPreferences } = useWorkspaceData();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [finishing, setFinishing] = useState(false);

  async function finish(mode: "save" | "defaults" | "later") {
    setFinishing(true);
    if (mode === "defaults") await updatePreferences(DEFAULT_PREFERENCES);
    await updateProfile({
      onboarding_completed: true,
      ...(mode === "save" && name.trim() ? { display_name: name.trim().slice(0, 60) } : {}),
    });
    // Full page load so the session cookie and workspace data are read fresh.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/workspace");
  }

  const toggleTool = (type: BlockType) =>
    updatePreferences({
      preferredTools: preferences.preferredTools.includes(type) ? preferences.preferredTools.filter((item) => item !== type) : [...preferences.preferredTools, type],
    });

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Wordmark className="text-lg" />
        <div className="flex flex-wrap gap-2">
          <button type="button" className="mc-btn mc-btn-ghost" onClick={() => finish("defaults")} disabled={finishing}>
            Use defaults
          </button>
          <button type="button" className="mc-btn mc-btn-secondary" onClick={() => finish("later")} disabled={finishing}>
            Set this up later
          </button>
        </div>
      </header>

      <main className="mt-8 grid flex-1 gap-8 lg:grid-cols-[1fr_20rem]">
        <section aria-labelledby="step-heading">
          <p className="mc-hint" aria-live="polite">
            Step {step + 1} of {STEPS.length}
          </p>
          <ol className="mt-2 flex gap-1.5" aria-hidden="true">
            {STEPS.map((label, index) => (
              <li key={label} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`} />
            ))}
          </ol>

          <div className="mt-6">
            {step === 0 ? (
              <>
                <h1 id="step-heading" className="text-2xl font-bold">
                  What should we call you?
                </h1>
                <div className="mt-4 max-w-sm">
                  <TextField label="Display name" optional value={name} maxLength={60} onChange={(event) => setName(event.target.value)} autoComplete="nickname" />
                </div>
              </>
            ) : null}
            {step === 1 ? (
              <>
                <h1 id="step-heading" className="mb-4 text-2xl font-bold">
                  Pick a theme
                </h1>
                <AppearanceFields value={preferences} onChange={updatePreferences} fields={["theme", "accent"]} />
              </>
            ) : null}
            {step === 2 ? (
              <>
                <h1 id="step-heading" className="mb-4 text-2xl font-bold">
                  Font and text size
                </h1>
                <AppearanceFields value={preferences} onChange={updatePreferences} fields={["fontFamily", "textSize", "lineHeight", "wordSpacing"]} />
              </>
            ) : null}
            {step === 3 ? (
              <>
                <h1 id="step-heading" className="mb-4 text-2xl font-bold">
                  How much on screen at once?
                </h1>
                <AppearanceFields value={preferences} onChange={updatePreferences} fields={["density", "reducedMotion"]} />
              </>
            ) : null}
            {step === 4 ? (
              <>
                <h1 id="step-heading" className="text-2xl font-bold">
                  Which tools might help?
                </h1>
                <p className="mc-hint mb-4 mt-1">Nothing is added until you confirm.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BLOCK_ORDER.map((type) => (
                    <label key={type} className={`flex items-center gap-3 rounded-xl border-2 p-3 ${preferences.preferredTools.includes(type) ? "border-primary" : "border-border"}`}>
                      <input type="checkbox" className="h-5 w-5" checked={preferences.preferredTools.includes(type)} onChange={() => toggleTool(type)} />
                      <BlockTile type={type} size={36} />
                      <span className="font-semibold">{BLOCK_DEFINITIONS[type].label}</span>
                    </label>
                  ))}
                </div>
              </>
            ) : null}
            {step === 5 ? (
              <>
                <h1 id="step-heading" className="text-2xl font-bold">
                  Would reminders be welcome?
                </h1>
                <p className="mc-hint mb-4 mt-1">Reminders only appear while Mindcraft is open.</p>
                <div role="radiogroup" aria-label="Reminders" className="flex flex-col gap-2">
                  {[
                    ["off", "No reminders"],
                    ["friendly", "Yes, friendly reminders"],
                    ["minimal", "Yes, short and minimal"],
                  ].map(([value, label]) => (
                    <label key={value} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3">
                      <input
                        type="radio"
                        name="reminders"
                        className="h-5 w-5"
                        checked={(notificationPreferences?.style ?? "off") === value}
                        onChange={() => updateNotificationPreferences({ style: value as "off" | "friendly" | "minimal" })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            <button type="button" className="mc-btn mc-btn-ghost" disabled={step === 0} onClick={() => setStep((value) => value - 1)}>
              Back
            </button>
            {isLast ? (
              <button type="button" className="mc-btn mc-btn-primary" onClick={() => finish("save")} disabled={finishing}>
                Go to my workspace
              </button>
            ) : (
              <button type="button" className="mc-btn mc-btn-primary" onClick={() => setStep((value) => value + 1)}>
                Next
              </button>
            )}
            {!isLast ? (
              <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setStep((value) => value + 1)}>
                Skip this question
              </button>
            ) : null}
          </div>
        </section>
        <aside aria-label="Live preview" className="lg:sticky lg:top-6 lg:self-start">
          <AppearancePreview />
        </aside>
      </main>
    </div>
  );
}
