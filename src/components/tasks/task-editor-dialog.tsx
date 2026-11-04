"use client";

import { Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { taskInputSchema } from "@/lib/schemas";
import { STATUS_LABELS, formatDeadline, stepsForTask } from "@/lib/task-helpers";
import type { Task, TaskStatus } from "@/lib/types";
import { ChecklistEditor } from "../blocks/checklist-editor";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { SelectField, TextAreaField, TextField } from "../ui/field";
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
  const { createTask, updateTask, deleteTask, restoreTask, ensureProject, projects, steps, addStep, updateStep, deleteStep } = useWorkspaceData();
  const { announce, notify } = useNotify();
  const projectName = projects.find((project) => project.id === task?.project_id)?.name ?? "";
  const [values, setValues] = useState({
    title: task?.title ?? "",
    description: task?.description ?? "",
    expected_result: task?.expected_result ?? "",
    due_date: task?.due_date ?? "",
    due_time: task?.due_time?.slice(0, 5) ?? "",
    project: projectName,
    assignee: task?.assignee ?? "",
    priority: task?.priority ?? "",
    source_link: task?.source_link ?? "",
    status: task?.status ?? "todo",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  // A deadline only changes through the explicit Edit deadline action.
  const [editingDeadline, setEditingDeadline] = useState(!task);
  const taskSteps = task ? stepsForTask(steps, task.id) : [];

  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const { project, ...fields } = values;
    const parsed = taskInputSchema.safeParse({
      ...fields,
      due_date: values.due_date || null,
      due_time: values.due_date && values.due_time ? values.due_time : null,
      priority: values.priority || null,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    const linkedProject = await ensureProject(project);
    const input = { ...parsed.data, project_id: linkedProject?.id ?? null };
    if (task) {
      await updateTask(task.id, input as Partial<Task>);
      announce("Task saved.");
    } else {
      const created = await createTask(input);
      if (created) announce(`Task added: ${created.title}`);
    }
    onClose();
  }

  async function handleDelete() {
    if (!task) return;
    const snapshot = await deleteTask(task.id);
    onClose();
    if (snapshot) notify(`Deleted "${task.title}".`, { action: { label: "Undo", onClick: () => restoreTask(snapshot) } });
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={task ? "Task details" : "Add task"} description={task ? undefined : "Only the title is required."} wide>
      <form onSubmit={handleSubmit} noValidate className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <TextField label="Title" value={values.title} onChange={set("title")} error={errors.title} maxLength={200} autoFocus />
        </div>
        <div className="md:col-span-2">
          <TextAreaField label="Instructions" optional value={values.description} onChange={set("description")} maxLength={4000} />
        </div>
        <div className="md:col-span-2">
          <TextField label="Expected deliverable" optional value={values.expected_result} onChange={set("expected_result")} maxLength={1000} />
        </div>

        {editingDeadline ? (
          <div className="grid gap-4 sm:grid-cols-2 md:col-span-2">
            <TextField label="Deadline" optional type="date" value={values.due_date} onChange={set("due_date")} error={errors.due_date} />
            <TextField label="Deadline time" optional type="time" value={values.due_time} disabled={!values.due_date} onChange={set("due_time")} />
          </div>
        ) : (
          <div className="md:col-span-2">
            <p className="mc-label">Deadline</p>
            <div className="flex flex-wrap items-center gap-2">
              <span>{task ? formatDeadline(task) : ""}</span>
              <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => setEditingDeadline(true)}>
                <Pencil size={14} aria-hidden="true" /> Edit deadline
              </button>
            </div>
          </div>
        )}

        <SelectField label="Priority" value={values.priority} onChange={set("priority")}>
          <option value="">None</option>
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
        <TextField label="Project" optional list="task-project-options" value={values.project} maxLength={120} onChange={set("project")} />
        <datalist id="task-project-options">
          {projects.map((project) => (
            <option key={project.id} value={project.name} />
          ))}
        </datalist>
        <TextField label="Assignee" optional value={values.assignee} maxLength={120} onChange={set("assignee")} />
        <div className="md:col-span-2">
          <TextField label="Source link" optional type="url" placeholder="https://…" value={values.source_link} onChange={set("source_link")} maxLength={1000} />
        </div>

        {task ? (
          <fieldset className="md:col-span-2">
            <legend className="mc-label">Steps</legend>
            <ChecklistEditor items={taskSteps} noun="step" onAdd={(text) => addStep(task.id, text)} onChange={updateStep} onDelete={deleteStep} />
          </fieldset>
        ) : null}

        <div className="flex flex-wrap justify-between gap-2 md:col-span-2">
          {task ? (
            <button type="button" className="mc-btn mc-btn-danger" onClick={handleDelete}>
              Delete task
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="mc-btn mc-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mc-btn mc-btn-primary">
              {task ? "Save task" : "Add task"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
