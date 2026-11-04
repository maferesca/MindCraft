"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { stepTextSchema, taskInputSchema } from "@/lib/schemas";
import { STATUS_LABELS, stepsForTask } from "@/lib/task-helpers";
import type { Task, TaskStatus } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { SelectField, TextAreaField, TextField } from "../ui/field";
import { IconButton } from "../ui/icon-button";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";

export function TaskEditorDialog() {
  const { taskEditor, closeTaskEditor } = useWorkspaceUI();
  const { tasks } = useWorkspaceData();
  if (!taskEditor) return null;
  const task = taskEditor.taskId ? tasks.find((item) => item.id === taskEditor.taskId) ?? null : null;
  return <TaskEditorForm key={task?.id ?? "new"} task={task} onClose={closeTaskEditor} />;
}

function TaskEditorForm({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { createTask, updateTask, steps, addStep, updateStep, deleteStep } = useWorkspaceData();
  const { announce } = useNotify();
  const [values, setValues] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    expected_result: task?.expected_result ?? "",
    due_date: task?.due_date ?? "",
    priority: task?.priority ?? "",
    source_link: task?.source_link ?? "",
    status: task?.status ?? "todo",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newStep, setNewStep] = useState("");
  const taskSteps = task ? stepsForTask(steps, task.id) : [];

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = taskInputSchema.safeParse({
      ...values,
      due_date: values.due_date || null,
      priority: values.priority || null,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    if (task) {
      await updateTask(task.id, parsed.data as Partial<Task>);
      announce("Task saved.");
    } else {
      const created = await createTask(parsed.data);
      if (created) announce(`Task added: ${created.title}`);
    }
    onClose();
  }

  async function handleAddStep() {
    if (!task) return;
    const parsed = stepTextSchema.safeParse(newStep);
    if (!parsed.success) return;
    await addStep(task.id, parsed.data);
    setNewStep("");
  }

  async function moveStep(index: number, direction: -1 | 1) {
    const other = taskSteps[index + direction];
    const current = taskSteps[index];
    if (!other || !current) return;
    await updateStep(current.id, { position: other.position });
    await updateStep(other.id, { position: current.position === other.position ? current.position + direction : current.position });
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={task ? "Edit task" : "New task"}
      description="Only the title is required."
      wide
    >
      <form onSubmit={handleSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextField label="Title" value={values.title} onChange={set("title")} error={errors.title} maxLength={200} autoFocus />
        </div>
        <div className="md:col-span-2">
          <TextAreaField label="Description" optional value={values.description} onChange={set("description")} maxLength={4000} />
        </div>
        <div className="md:col-span-2">
          <TextField
            label="Expected result"
            optional
            value={values.expected_result}
            onChange={set("expected_result")}
            maxLength={1000}
          />
        </div>
        <TextField label="Deadline" optional type="date" value={values.due_date} onChange={set("due_date")} error={errors.due_date} />
        <SelectField label="Priority" optional value={values.priority} onChange={set("priority")}>
          <option value="">Not set</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </SelectField>
        <SelectField label="Status" value={values.status} onChange={set("status")}>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value as TaskStatus}>
              {label}
            </option>
          ))}
        </SelectField>
        <TextField label="Source link" optional type="url" placeholder="https://…" value={values.source_link} onChange={set("source_link")} maxLength={1000} />

        {task ? (
          <fieldset className="md:col-span-2">
            <legend className="mc-label">Your steps</legend>
            <ol className="flex flex-col gap-1">
              {taskSteps.map((step, index) => (
                <li key={step.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={step.done}
                    aria-label={`Step ${index + 1} done`}
                    onChange={(event) => updateStep(step.id, { done: event.target.checked })}
                  />
                  <label className="sr-only" htmlFor={`step-${step.id}`}>
                    Step {index + 1}
                  </label>
                  <input
                    id={`step-${step.id}`}
                    className="mc-input"
                    defaultValue={step.text}
                    maxLength={500}
                    onBlur={(event) => {
                      const text = event.target.value.trim();
                      if (text && text !== step.text) updateStep(step.id, { text });
                    }}
                  />
                  <IconButton size="sm" label="Move step earlier" icon={<ArrowUp size={16} />} disabled={index === 0} onClick={() => moveStep(index, -1)} />
                  <IconButton
                    size="sm"
                    label="Move step later"
                    icon={<ArrowDown size={16} />}
                    disabled={index === taskSteps.length - 1}
                    onClick={() => moveStep(index, 1)}
                  />
                  <IconButton size="sm" label="Delete step" icon={<Trash2 size={16} />} onClick={() => deleteStep(step.id)} />
                </li>
              ))}
            </ol>
            <div className="mt-2 flex gap-2">
              <label className="sr-only" htmlFor="new-step">
                New step
              </label>
              <input
                id="new-step"
                className="mc-input"
                placeholder="Add a step…"
                value={newStep}
                maxLength={500}
                onChange={(event) => setNewStep(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleAddStep();
                  }
                }}
              />
              <button type="button" className="mc-btn mc-btn-secondary shrink-0" onClick={handleAddStep}>
                <Plus size={16} aria-hidden="true" /> Add step
              </button>
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2 md:col-span-2">
          <button type="button" className="mc-btn mc-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="mc-btn mc-btn-primary">
            {task ? "Save task" : "Add task"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
