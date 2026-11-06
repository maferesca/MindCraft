"use client";

import { Check, ListChecks, Minimize2, Sparkles } from "lucide-react";
import { useState } from "react";
import { ASSISTANCE_LEVELS, type Preferences } from "@/lib/preferences";
import { currentStep, stepProgressLabel, stepRequestMessage, stepWindow, stepsForTask } from "@/lib/task-helpers";
import type { Task } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { ChoiceGroup } from "../ui/choice-group";
import { useNotify } from "../ui/notifications";
import { ReadAloud } from "../ui/read-aloud";
import { ChecklistEditor } from "./checklist-editor";
import { StepFlow } from "./step-flow";

const LEVEL_OPTIONS = (Object.keys(ASSISTANCE_LEVELS) as Array<Preferences["planningStyle"]>).map(
  (level) => [level, ASSISTANCE_LEVELS[level].label] as [Preferences["planningStyle"], string],
);
const SUGGEST_LABELS: Record<Preferences["planningStyle"], string> = {
  one_step: "Suggest a next step",
  short_list: "Suggest 3 to 5 steps",
  full_overview: "Break into small steps",
};

// Step guidance shared by the Task guide block and Focus Mode. The assistance level
// and view are personal preferences that only change what is shown: the steps and
// their progress stay on the task. Completing a step never completes the task.
export function CurrentStep({ task, onAllDone, inTaskGuide = false }: { task: Task; onAllDone?: () => void; inTaskGuide?: boolean }) {
  const { steps, preferences, updatePreferences, addStep, updateStep, deleteStep, claimProgress } = useWorkspaceData();
  const { openAssistant } = useWorkspaceUI();
  const { announce } = useNotify();
  const [editing, setEditing] = useState(false);
  const [extraShown, setExtraShown] = useState(0);
  const level = preferences.planningStyle;
  const taskSteps = stepsForTask(steps, task.id);
  const step = currentStep(steps, task.id);
  const doneCount = taskSteps.filter((item) => item.done).length;
  const { shown, doneHidden, laterHidden } = stepWindow(taskSteps, level, extraShown);
  const spoken = shown.filter((item) => !item.done).map((item) => item.text);

  async function complete() {
    if (!step) return;
    await updateStep(step.id, { done: true });
    announce("Step done. The task stays open until you mark it done.");
    if (inTaskGuide && step.id === taskSteps[0]?.id) claimProgress("first_step", task.id);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <ChoiceGroup label="Assistance level" value={level} options={LEVEL_OPTIONS} onChange={(planningStyle) => updatePreferences({ planningStyle })} />
        <ChoiceGroup
          label="Step view"
          value={preferences.stepLayout}
          options={[["list", "List"], ["visual", "Visual"]]}
          onChange={(stepLayout) => updatePreferences({ stepLayout })}
        />
        <ReadAloud text={spoken.join(". ")} label={spoken.length > 1 ? "Read these steps aloud" : "Read this step aloud"} />
      </div>

      {taskSteps.length ? (
        <p className="text-sm font-semibold" aria-live="polite">
          {stepProgressLabel(doneCount, taskSteps.length)}
        </p>
      ) : null}

      {editing || !taskSteps.length ? (
        <ChecklistEditor
          items={taskSteps}
          noun="step"
          onAdd={(text) => {
            // The first step would otherwise close the editor, stopping the next one.
            setEditing(true);
            addStep(task.id, text);
          }}
          onChange={updateStep}
          onDelete={deleteStep}
        />
      ) : (
        <>
          <StepFlow steps={shown} allSteps={taskSteps} currentId={step?.id ?? null} layout={preferences.stepLayout} />
          {doneHidden && level !== "short_list" && step ? <p className="mc-hint">{doneHidden} done so far.</p> : null}
          {!step ? (
            <div className="rounded-xl bg-surface-muted p-3" role="status">
              <p className="font-semibold">All written steps are done.</p>
              {onAllDone ? (
                <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm mt-2" onClick={onAllDone}>
                  Open review checklist
                </button>
              ) : null}
            </div>
          ) : null}
          {laterHidden && level === "full_overview" ? (
            <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm self-start" onClick={() => setExtraShown((value) => value + 1)}>
              Show the next step ({laterHidden} more)
            </button>
          ) : null}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        {step && !editing ? (
          <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={complete}>
            <Check size={16} aria-hidden="true" /> Step done
          </button>
        ) : null}
        {step ? (
          <button
            type="button"
            className="mc-btn mc-btn-secondary mc-btn-sm"
            onClick={() => openAssistant({ mode: "help_me_start", taskId: task.id, autoSend: true, helpRequest: "smaller", message: `This step feels too big: "${step.text}". Could you suggest smaller steps?` })}
          >
            <Minimize2 size={16} aria-hidden="true" /> Make this smaller
          </button>
        ) : null}
        <button
          type="button"
          className="mc-btn mc-btn-secondary mc-btn-sm"
          onClick={() => openAssistant({ mode: "help_me_start", taskId: task.id, autoSend: true, helpRequest: "steps", message: stepRequestMessage(level, task.title) })}
        >
          <Sparkles size={16} aria-hidden="true" /> {SUGGEST_LABELS[level]}
        </button>
        {taskSteps.length ? (
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" aria-pressed={editing} onClick={() => setEditing((value) => !value)}>
            <ListChecks size={16} aria-hidden="true" /> {editing ? "Done editing" : "Edit steps"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
