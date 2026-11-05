"use client";

import { Check } from "lucide-react";
import type { TaskStep } from "@/lib/types";

interface StepFlowProps {
  steps: TaskStep[];
  // Every step number stays the one from the whole task, even when some are not shown.
  allSteps: TaskStep[];
  currentId: string | null;
  layout: "list" | "visual";
}

// List View and Visual View read the same step records, so progress is the same in both.
export function StepFlow({ steps, allSteps, currentId, layout }: StepFlowProps) {
  if (!steps.length) return null;
  const numberOf = (step: TaskStep) => allSteps.findIndex((item) => item.id === step.id) + 1;

  if (layout === "list") {
    return (
      <ol className="flex flex-col gap-1">
        {steps.map((step) => {
          const current = step.id === currentId;
          return (
            <li key={step.id} aria-current={current ? "step" : undefined} className={`flex items-start gap-2 rounded-lg p-2 ${current ? "bg-primary-soft font-semibold" : ""}`}>
              <StepMark done={step.done} number={numberOf(step)} current={current} />
              <span className={step.done ? "text-text-muted line-through" : ""}>{step.text}</span>
              <span className="sr-only">{step.done ? "(done)" : current ? "(current step)" : ""}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol className="flex flex-col" aria-label="Steps as a flow">
      {steps.map((step, index) => {
        const current = step.id === currentId;
        return (
          <li key={step.id} aria-current={current ? "step" : undefined} className="flex flex-col items-center">
            {index > 0 ? <span aria-hidden="true" className="h-4 w-0.5 bg-border-strong" /> : null}
            <div
              className={`flex w-full items-start gap-2 rounded-xl border-2 p-3 ${
                current ? "border-primary bg-primary-soft font-semibold" : step.done ? "border-border bg-surface-muted" : "border-border bg-surface"
              }`}
            >
              <StepMark done={step.done} number={numberOf(step)} current={current} />
              <span className={step.done ? "text-text-muted line-through" : ""}>{step.text}</span>
              <span className="sr-only">{step.done ? "(done)" : current ? "(current step)" : ""}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StepMark({ done, number, current }: { done: boolean; number: number; current: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
        current ? "border-primary bg-primary text-on-primary" : "border-border-strong"
      }`}
    >
      {done ? <Check size={14} /> : number}
    </span>
  );
}
