"use client";

import { START_HELP_LABELS, type Preferences } from "@/lib/preferences";
import { Segmented } from "./appearance-fields";

type Field = "planningStyle" | "focusTime" | "startHelp" | "workMinutes" | "responseDetail";

const ALL_FIELDS: Field[] = ["planningStyle", "focusTime", "startHelp", "workMinutes", "responseDetail"];

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
          <p className="mc-label">How do you like to see your work?</p>
          <Segmented
            label="How do you like to see your work?"
            value={value.planningStyle}
            options={[["one_step", "One step at a time"], ["short_list", "A short list"], ["full_overview", "The full overview"]]}
            onChange={(next) => onChange({ planningStyle: next as Preferences["planningStyle"] })}
          />
        </div>
      ) : null}
      {show("focusTime") ? (
        <div>
          <p className="mc-label">When do you usually focus best?</p>
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
