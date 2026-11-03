"use client";

import { Check, CircleHelp, Minimize2, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { stepTextSchema } from "@/lib/schemas";
import { currentStep, openTasks, stepsForTask } from "@/lib/task-helpers";
import type { Task, TaskStep, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { useNotify } from "../ui/notifications";

// Shows one task and its current action. Works fully without AI.
export function NextStepBlock({ block }: { block: WorkspaceBlock }) {
  const { tasks, updateBlockConfig } = useWorkspaceData();
  const taskId = (block.config.taskId as string | undefined) ?? null;
  const task = tasks.find((item) => item.id === taskId) ?? null;
  const candidates = openTasks(tasks);

  return (
    <div className="flex h-full flex-col gap-3">
      <div>
        <label htmlFor={`next-step-task-${block.id}`} className="mc-label text-sm">
          Task
        </label>
        <select
          id={`next-step-task-${block.id}`}
          className="mc-input"
          value={task?.id ?? ""}
          onChange={(event) => updateBlockConfig(block.id, { taskId: event.target.value || null })}
        >
          <option value="">Choose a task…</option>
          {candidates.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
          {task && task.status === "done" ? <option value={task.id}>{task.title} (done)</option> : null}
        </select>
      </div>
      {task ? <CurrentStep task={task} /> : <p className="mc-hint">{candidates.length ? "Pick a task to see one action at a time." : "Add a task first, then pick it here."}</p>}
    </div>
  );
}

export function CurrentStep({ task, compact = false }: { task: Task; compact?: boolean }) {
  const { steps, addStep, updateStep } = useWorkspaceData();
  const { openAssistant, openMissingInfo } = useWorkspaceUI();
  const { announce } = useNotify();
  const step = currentStep(steps, task.id);
  const doneCount = stepsForTask(steps, task.id).filter((item) => item.done).length;
  const [editing, setEditing] = useState<"new" | "edit" | null>(null);
  const [text, setText] = useState("");

  async function save() {
    const parsed = stepTextSchema.safeParse(text);
    if (!parsed.success) return;
    if (editing === "edit" && step) await updateStep(step.id, { text: parsed.data });
    else await addStep(task.id, parsed.data);
    setEditing(null);
    setText("");
  }

  async function complete(current: TaskStep) {
    await updateStep(current.id, { done: true });
    announce("Step done. The task stays open until you mark it done.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl bg-primary-soft p-3">
        <p className="text-sm font-semibold text-text-muted">Current step</p>
        {editing ? (
          <div className="mt-1 flex flex-col gap-2">
            <label htmlFor={`step-text-${task.id}`} className="sr-only">
              Step
            </label>
            <textarea
              id={`step-text-${task.id}`}
              className="mc-input"
              rows={2}
              maxLength={500}
              value={text}
              autoFocus
              onChange={(event) => setText(event.target.value)}
            />
            <div className="flex gap-2">
              <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={save}>
                Save step
              </button>
              <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => setEditing(null)}>
                Cancel
              </button>
            </div>
          </div>
        ) : step ? (
          <p className={`mt-1 font-semibold ${compact ? "" : "text-lg"}`}>{step.text}</p>
        ) : (
          <p className="mt-1">{doneCount ? "All written steps are done." : "No step written yet."}</p>
        )}
      </div>
      {!editing ? (
        <div className="flex flex-wrap gap-2">
          {step ? (
            <>
              <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={() => complete(step)}>
                <Check size={16} aria-hidden="true" /> Step done
              </button>
              <button
                type="button"
                className="mc-btn mc-btn-secondary mc-btn-sm"
                onClick={() => {
                  setText(step.text);
                  setEditing("edit");
                }}
              >
                <Pencil size={16} aria-hidden="true" /> Edit
              </button>
              <button
                type="button"
                className="mc-btn mc-btn-secondary mc-btn-sm"
                onClick={() =>
                  openAssistant({
                    mode: "help_me_start",
                    taskId: task.id,
                    autoSend: true,
                    message: `This step feels too big: "${step.text}". Could you suggest smaller steps?`,
                  })
                }
              >
                <Minimize2 size={16} aria-hidden="true" /> Make this smaller
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="mc-btn mc-btn-secondary mc-btn-sm"
            onClick={() => {
              setText("");
              setEditing("new");
            }}
          >
            <Plus size={16} aria-hidden="true" /> {step ? "Add step" : "Write a step"}
          </button>
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => openMissingInfo(task.id)}>
            <CircleHelp size={16} aria-hidden="true" /> I&apos;m blocked
          </button>
        </div>
      ) : null}
    </div>
  );
}
