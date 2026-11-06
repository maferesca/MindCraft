"use client";

import { useState, type FormEvent } from "react";
import { helpInputSchema, progressInputSchema } from "@/lib/schemas";
import { NO_SUPPORT_YET } from "@/lib/task-helpers";
import type { CheckIn } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { SelectField, TextAreaField } from "../ui/field";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";

interface CheckInFormProps {
  kind: CheckIn["kind"];
  entry?: CheckIn | null;
  taskId?: string | null;
  // The same help request, worded for something missing. Support may stay empty.
  missingInfo?: boolean;
  onClose: () => void;
}

// Writes a private draft. Sharing needs team members and a team view, which do
// not exist yet, so Share stays disabled and nothing is ever reported as sent.
export function CheckInForm({ kind, entry = null, taskId = null, missingInfo = false, onClose }: CheckInFormProps) {
  const { tasks, checkInActions } = useWorkspaceData();
  const { notify } = useNotify();
  const help = kind === "help";
  const [values, setValues] = useState({
    task_id: entry?.task_id ?? taskId ?? "",
    completed_text: entry?.completed_text ?? "",
    next_text: entry?.next_text ?? "",
    blocking: entry?.blocking ?? "",
    support: entry?.support === NO_SUPPORT_YET ? "" : (entry?.support ?? ""),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));
  const completedTasks = tasks.filter((task) => task.status === "done");

  function insertCompleted(title: string) {
    setValues((current) => ({ ...current, completed_text: current.completed_text ? `${current.completed_text}\n- ${title}` : `- ${title}` }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const task_id = values.task_id || null;
    const support = missingInfo ? values.support.trim() || NO_SUPPORT_YET : values.support;
    const parsed = help ? helpInputSchema.safeParse({ task_id, blocking: values.blocking, support }) : progressInputSchema.safeParse({ task_id, completed_text: values.completed_text, next_text: values.next_text });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      if (missingInfo && next.blocking) next.blocking = "Describe what is missing";
      setErrors(next);
      return;
    }
    const input: Partial<CheckIn> = entry ? parsed.data : { ...parsed.data, kind, help_status: help ? "open" : null, follow_ups: [] };
    const ok = entry ? await checkInActions.update(entry.id, input) : await checkInActions.create(input);
    if (ok) {
      notify(missingInfo ? "Saved to this task. Only you can see it." : "Draft saved. Only you can see it.");
      onClose();
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={missingInfo ? "Missing information" : help ? "I need help" : "Progress update"}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <SelectField label="Task" optional value={values.task_id} onChange={set("task_id")}>
          <option value="">No task</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </SelectField>
        {help ? (
          <>
            <TextAreaField label={missingInfo ? "What information is missing?" : "What is blocking you?"} value={values.blocking} error={errors.blocking} maxLength={4000} autoFocus onChange={set("blocking")} />
            <TextAreaField label={missingInfo ? "Who or what could help?" : "What support do you need?"} optional={missingInfo} value={values.support} error={errors.support} maxLength={4000} onChange={set("support")} />
          </>
        ) : (
          <>
            {completedTasks.length ? (
              <div>
                <p className="mc-label text-sm">Insert a completed task</p>
                <div className="flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                  {completedTasks.map((task) => (
                    <button key={task.id} type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => insertCompleted(task.title)}>
                      {task.title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <TextAreaField label="Completed" value={values.completed_text} error={errors.completed_text} maxLength={4000} onChange={set("completed_text")} />
            <TextAreaField label="Next" value={values.next_text} maxLength={4000} onChange={set("next_text")} />
          </>
        )}
        <p className="mc-hint">{missingInfo ? "Only you can see this." : "Sharing isn't available yet. This stays a private draft."}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="mc-btn mc-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          {missingInfo ? null : (
            <button type="button" className="mc-btn mc-btn-secondary" disabled title="Sharing isn't available yet">
              Share
            </button>
          )}
          <button type="submit" className="mc-btn mc-btn-primary">
            {missingInfo ? "Save to task" : "Save draft"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Opens the help form with the task selected, or the entry being edited.
export function MissingInfoDialog() {
  const { checkIns } = useWorkspaceData();
  const { missingInfo, closeMissingInfo } = useWorkspaceUI();
  if (!missingInfo) return null;
  const entry = checkIns.find((item) => item.id === missingInfo.entryId) ?? null;
  return <CheckInForm key={missingInfo.entryId ?? missingInfo.taskId} kind="help" missingInfo entry={entry} taskId={missingInfo.taskId} onClose={closeMissingInfo} />;
}
