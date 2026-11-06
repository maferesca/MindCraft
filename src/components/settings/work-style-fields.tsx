"use client";

import { ASSISTANCE_LEVELS, COMMUNICATION_STYLES, START_HELP_LABELS, type Preferences } from "@/lib/preferences";
import { Segmented } from "./appearance-fields";

type Field = "planningStyle" | "communicationStyle" | "taskPresentation" | "focusTime" | "startHelp" | "workMinutes" | "responseDetail";

const ALL_FIELDS: Field[] = ["planningStyle", "communicationStyle", "focusTime", "startHelp", "workMinutes"];

// Optional answers the assistant uses to tailor its suggestions. They describe
// how someone likes to work, never who they are.
export function WorkStyleFields({ value, onChange, fields = ALL_FIELDS }: { value: Preferences; onChange: (patch: Partial<Preferences>) => void; fields?: Field[] }) {
  const show = (field: Field) => fields.includes(field);
  const toggleHelp = (option: Preferences["startHelp"][number]) =>
    onChange({ startHelp: value.startHelp.includes(option) ? value.startHelp.filter((item) => item !== option) : [...value.startHelp, option] });

  return (
    <div className="flex flex-col gap-5">
      {show("planningStyle") ? (
        <div>
          <p className="mc-label">How much help do you want with a task?</p>
          <Segmented
            label="How much help do you want with a task?"
            value={value.planningStyle}
            options={(Object.keys(ASSISTANCE_LEVELS) as Array<Preferences["planningStyle"]>).map((level) => [level, ASSISTANCE_LEVELS[level].label])}
            onChange={(next) => onChange({ planningStyle: next as Preferences["planningStyle"] })}
          />
          <p className="mc-hint mt-1">{ASSISTANCE_LEVELS[value.planningStyle].description} This sets how steps appear in the Task guide and Focus Mode, and you can change it there at any time.</p>
        </div>
      ) : null}
      {show("communicationStyle") ? (
        <div>
          <p className="mc-label">How should MindCraft talk to you?</p>
          <Segmented
            label="How should MindCraft talk to you?"
            value={value.communicationStyle}
            options={(Object.keys(COMMUNICATION_STYLES) as Array<Preferences["communicationStyle"]>).map((style) => [style, COMMUNICATION_STYLES[style].label])}
            onChange={(next) => onChange({ communicationStyle: next as Preferences["communicationStyle"] })}
          />
          <p className="mc-hint mt-1">{COMMUNICATION_STYLES[value.communicationStyle].description} This changes the assistant&apos;s wording, never what a task requires.</p>
        </div>
      ) : null}
      {show("taskPresentation") ? (
        <div>
          <p className="mc-label">How should the assistant present tasks?</p>
          <Segmented
            label="How should the assistant present tasks?"
            value={value.taskPresentation}
            options={[["not_set", "No preference"], ["checklist", "As a checklist"], ["short_text", "In short paragraphs"]]}
            onChange={(next) => onChange({ taskPresentation: next as Preferences["taskPresentation"] })}
          />
        </div>
      ) : null}
      {show("focusTime") ? (
        <div>
          <p className="mc-label">When do you usually focus best?</p>
          <p className="mc-hint mb-1">The assistant uses this when it suggests a time for your work.</p>
          <Segmented
            label="When do you usually focus best?"
            value={value.focusTime}
            options={[["morning", "Morning"], ["afternoon", "Afternoon"], ["evening", "Evening"], ["varies", "It varies"]]}
            onChange={(next) => onChange({ focusTime: next as Preferences["focusTime"] })}
          />
        </div>
      ) : null}
      {show("startHelp") ? (
        <fieldset>
          <legend className="mc-label">What helps you get started?</legend>
          <p className="mc-hint mb-1">The assistant favors these when you ask for help starting.</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(START_HELP_LABELS) as Array<Preferences["startHelp"][number]>).map((option) => (
              <label key={option} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border-2 px-3 ${value.startHelp.includes(option) ? "border-primary bg-primary-soft font-semibold" : "border-border"}`}>
                <input type="checkbox" className="h-5 w-5" checked={value.startHelp.includes(option)} onChange={() => toggleHelp(option)} />
                {START_HELP_LABELS[option]}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {show("workMinutes") ? (
        <div>
          <p className="mc-label">How long do you like to focus at a time?</p>
          <p className="mc-hint mb-1">This sets the Focus timer and the assistant&apos;s time estimates.</p>
          <Segmented
            label="How long do you like to focus at a time?"
            value={String(value.workMinutes)}
            options={[["15", "15 min"], ["25", "25 min"], ["45", "45 min"], ["60", "60 min"]]}
            onChange={(next) => onChange({ workMinutes: Number(next) })}
          />
        </div>
      ) : null}
      {show("responseDetail") ? (
        <div>
          <p className="mc-label">How much detail do you want from the assistant?</p>
          <Segmented
            label="How much detail do you want from the assistant?"
            value={value.responseDetail}
            options={[["brief", "Brief"], ["balanced", "Balanced"], ["detailed", "Detailed"]]}
            onChange={(next) => onChange({ responseDetail: next as Preferences["responseDetail"] })}
          />
        </div>
      ) : null}
    </div>
  );
}
