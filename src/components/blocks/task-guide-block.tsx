"use client";

import { Check, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { formatDeadline, openTasks, stepsForTask } from "@/lib/task-helpers";
import type { Task, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { useNotify } from "../ui/notifications";
import { ChecklistEditor } from "./checklist-editor";
import { CurrentStep } from "./next-step-block";
import { TaskBlockers } from "./task-blockers";
import { useBlockConfig } from "./use-block-config";

const DEFAULTS = {
  taskId: null as string | null,
  includeCompleted: false,
  detailsOpen: true,
  stepsOpen: true,
  reviewOpen: false,
  resourcesOpen: true,
};
type GuideConfig = typeof DEFAULTS;
type SetGuideConfig = (patch: Partial<GuideConfig>) => void;

// Steps and review criteria are stored separately, and neither one completes the
// task: only "Mark task done" does.
export function TaskGuideBlock({ block }: { block: WorkspaceBlock }) {
  const { tasks } = useWorkspaceData();
  const { openTaskEditor } = useWorkspaceUI();
  const [config, setConfig] = useBlockConfig(block, DEFAULTS);
  const task = tasks.find((item) => item.id === config.taskId) ?? null;
  const choices = config.includeCompleted ? tasks : openTasks(tasks);

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label htmlFor={`guide-task-${block.id}`} className="mc-label text-sm">
          Task
        </label>
        <select id={`guide-task-${block.id}`} className="mc-input" value={task?.id ?? ""} onChange={(event) => setConfig({ taskId: event.target.value || null })}>
          <option value="">Choose a task…</option>
          {choices.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
              {item.status === "done" ? " (done)" : ""}
            </option>
          ))}
          {task && !choices.includes(task) ? <option value={task.id}>{task.title} (done)</option> : null}
        </select>
        <label className="mt-1 flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={config.includeCompleted} onChange={(event) => setConfig({ includeCompleted: event.target.checked })} />
          Include completed tasks
        </label>
      </div>
      {task ? (
        <GuideContent task={task} config={config} setConfig={setConfig} />
      ) : tasks.length ? null : (
        <div>
          <p className="mc-hint">No tasks yet.</p>
          <button type="button" className="mc-btn mc-btn-primary mc-btn-sm mt-2" onClick={() => openTaskEditor(null)}>
            Add task
          </button>
        </div>
      )}
    </div>
  );
}

function Section({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: (open: boolean) => void; children: ReactNode }) {
  return (
    <details
      open={open}
      onToggle={(event) => {
        if (event.currentTarget.open !== open) onToggle(event.currentTarget.open);
      }}
    >
      <summary className="cursor-pointer font-bold">{title}</summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function GuideContent({ task, config, setConfig }: { task: Task; config: GuideConfig; setConfig: SetGuideConfig }) {
  const { reviewItems, resources, reviewActions, updateTask } = useWorkspaceData();
  const { announce } = useNotify();
  const review = stepsForTask(reviewItems, task.id);
  const linkedResources = resources.filter((resource) => resource.task_id === task.id);

  return (
    <>
      <Section title={task.title} open={config.detailsOpen} onToggle={(detailsOpen) => setConfig({ detailsOpen })}>
        <dl className="flex flex-col gap-1 text-sm">
          <Detail label="Deadline">{formatDeadline(task)}</Detail>
          <Detail label="Instructions">{task.description || "Not provided"}</Detail>
          <Detail label="Expected deliverable">{task.expected_result || "Not provided"}</Detail>
        </dl>
      </Section>

      <Section title="Steps" open={config.stepsOpen} onToggle={(stepsOpen) => setConfig({ stepsOpen })}>
        <CurrentStep task={task} inTaskGuide onAllDone={() => setConfig({ reviewOpen: true })} />
      </Section>

      <Section title="Before submitting" open={config.reviewOpen} onToggle={(reviewOpen) => setConfig({ reviewOpen })}>
        <ChecklistEditor
          items={review}
          noun="criterion"
          onAdd={(text) => reviewActions.create({ task_id: task.id, text, position: review.length, done: false })}
          onChange={reviewActions.update}
          onDelete={reviewActions.remove}
        />
      </Section>

      {linkedResources.length ? (
        <Section title="Resources" open={config.resourcesOpen} onToggle={(resourcesOpen) => setConfig({ resourcesOpen })}>
          <ul className="flex flex-col gap-1 text-sm">
            {linkedResources.map((resource) => (
              <li key={resource.id}>
                <a href={resource.url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary underline underline-offset-4">
                  {resource.name} <ExternalLink size={13} aria-hidden="true" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <TaskBlockers task={task} />

      <div className="flex flex-wrap gap-2">
        {task.status === "done" ? (
          <p className="inline-flex items-center gap-1 font-semibold">
            <Check size={16} aria-hidden="true" /> Task done
          </p>
        ) : (
          <button
            type="button"
            className="mc-btn mc-btn-primary mc-btn-sm"
            onClick={async () => {
              await updateTask(task.id, { status: "done" });
              announce("Task marked done.");
            }}
          >
            Mark task done
          </button>
        )}
      </div>
    </>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{label}</dt>
      <dd className="whitespace-pre-wrap">{children}</dd>
    </div>
  );
}
