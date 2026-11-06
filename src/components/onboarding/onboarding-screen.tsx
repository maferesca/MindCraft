"use client";

import { useState } from "react";
import { catalogItemFor } from "@/lib/block-catalog";
import { BLOCK_ORDER } from "@/lib/blocks";
import { DEFAULT_PREFERENCES } from "@/lib/preferences";
import type { BlockType } from "@/lib/types";
import { Wordmark } from "../brand/brand-mark";
import { BlockTile } from "../blocks/block-icon";
import { AppProviders } from "../providers/app-providers";
import { useWorkspaceData } from "../providers/workspace-data";
import { AppearanceFields, AppearancePreview } from "../settings/appearance-fields";
import { WorkStyleFields } from "../settings/work-style-fields";
import { TextField } from "../ui/field";

export function OnboardingScreen() {
  return (
    <AppProviders>
      <Onboarding />
    </AppProviders>
  );
}

const STEPS = ["Your name", "Theme", "Reading", "How you work", "Tools", "Reminders"] as const;

// Short setup. Only the name is required; every later step can be skipped.
// Explicit choices are stored directly, and nothing about health, diagnosis,
// or personality is asked.
function Onboarding() {
  const { profile, preferences, updatePreferences, updateProfile, updateNotificationPreferences, notificationPreferences } = useWorkspaceData();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(profile?.display_name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  function next() {
    if (step === 0 && !name.trim()) {
      setNameError("Enter a name to continue.");
      return;
    }
    setNameError(null);
    setStep((value) => value + 1);
  }

  async function finish(mode: "save" | "defaults" | "later") {
    setFinishing(true);
    if (mode === "defaults") await updatePreferences(DEFAULT_PREFERENCES);
    await updateProfile({ onboarding_completed: true, display_name: name.trim().slice(0, 60) });
    // Full page load so the session cookie and workspace data are read fresh.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/workspace");
  }

  const toggleTool = (type: BlockType) =>
    updatePreferences({
      preferredTools: preferences.preferredTools.includes(type) ? preferences.preferredTools.filter((item) => item !== type) : [...preferences.preferredTools, type],
    });

  const isLast = step === STEPS.length - 1;
  const askingName = step === 0;
  // The sample only reflects appearance choices, so other steps go without it.
  const showPreview = step === 1 || step === 2;

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Wordmark className="text-2xl" markSize={44} />
        {askingName ? null : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="mc-btn mc-btn-ghost" onClick={() => finish("defaults")} disabled={finishing}>
              Use defaults
            </button>
            <button type="button" className="mc-btn mc-btn-secondary" onClick={() => finish("later")} disabled={finishing}>
              Set this up later
            </button>
          </div>
        )}
      </header>

      <main className={`mx-auto flex w-full flex-1 flex-col items-stretch justify-center gap-6 py-8 lg:flex-row lg:items-center ${showPreview ? "max-w-5xl" : askingName ? "max-w-lg" : "max-w-2xl"}`}>
        <section aria-labelledby="step-heading" className="mc-card min-w-0 flex-1 p-6 sm:p-8">
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
                <div className="mt-4">
                  <TextField
                    label="Display name"
                    required
                    aria-required="true"
                    autoFocus
                    value={name}
                    error={nameError}
                    maxLength={60}
                    autoComplete="nickname"
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") next();
                    }}
                  />
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
                  Make it comfortable to read
                </h1>
                <AppearanceFields value={preferences} onChange={updatePreferences} fields={["fontFamily", "textSize", "lineHeight", "wordSpacing", "density"]} />
              </>
            ) : null}
            {step === 3 ? (
              <>
                <h1 id="step-heading" className="text-2xl font-bold">
                  How do you like to work?
                </h1>
                <p className="mc-hint mb-4 mt-1">Each answer changes how the assistant helps you. You can change them at any time in Settings.</p>
                <WorkStyleFields value={preferences} onChange={updatePreferences} />
              </>
            ) : null}
            {step === 4 ? (
              <>
                <h1 id="step-heading" className="text-2xl font-bold">
                  Which tools might help?
                </h1>
                <p className="mc-hint mb-4 mt-1">Your choices become a suggested starter layout. Nothing is added to your workspace until you confirm it.</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {BLOCK_ORDER.map((type) => (
                    <label key={type} className={`flex items-start gap-3 rounded-xl border-2 p-3 ${preferences.preferredTools.includes(type) ? "border-primary" : "border-border"}`}>
                      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={preferences.preferredTools.includes(type)} onChange={() => toggleTool(type)} />
                      <BlockTile type={type} size={36} />
                      <span className="min-w-0">
                        <span className="block font-semibold">{catalogItemFor(type).name}</span>
                        <span className="block text-sm leading-snug">{catalogItemFor(type).description}</span>
                        <span className="mc-hint block leading-snug">Example: {catalogItemFor(type).example}</span>
                      </span>
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
                <p className="mc-hint mb-4 mt-1">Reminders only appear while MindCraft is open.</p>
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
            {askingName ? null : (
              <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setStep((value) => value - 1)}>
                Back
              </button>
            )}
            {isLast ? (
              <button type="button" className="mc-btn mc-btn-primary" onClick={() => finish("save")} disabled={finishing}>
                Go to my workspace
              </button>
            ) : (
              <button type="button" className={`mc-btn mc-btn-primary ${askingName ? "w-full" : ""}`} onClick={next}>
                Next
              </button>
            )}
            {!isLast && !askingName ? (
              <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setStep((value) => value + 1)}>
                Skip this question
              </button>
            ) : null}
          </div>
        </section>
        {showPreview ? (
          <aside aria-label="Live preview" className="w-full shrink-0 lg:w-80">
            <AppearancePreview />
          </aside>
        ) : null}
      </main>
    </div>
  );
}
