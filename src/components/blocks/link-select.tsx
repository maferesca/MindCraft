"use client";

import { useWorkspaceData } from "../providers/workspace-data";
import { SelectField } from "../ui/field";

export type LinkValue = { task_id: string | null; project_id: string | null };

export function linkKey(link: Partial<LinkValue>) {
  if (link.task_id) return `task:${link.task_id}`;
  if (link.project_id) return `project:${link.project_id}`;
  return "";
}

export function parseLink(key: string): LinkValue {
  const [kind, id] = key.split(":");
  return { task_id: kind === "task" ? id : null, project_id: kind === "project" ? id : null };
}

// Links a record to one task or one project, or to nothing.
export function LinkSelect({ value, onChange, label = "Linked to" }: { value: string; onChange: (key: string) => void; label?: string }) {
  const { tasks, projects } = useWorkspaceData();
  return (
    <SelectField label={label} optional value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Nothing</option>
      {tasks.length ? (
        <optgroup label="Tasks">
          {tasks.map((task) => (
            <option key={task.id} value={`task:${task.id}`}>
              {task.title}
            </option>
          ))}
        </optgroup>
      ) : null}
      {projects.length ? (
        <optgroup label="Projects">
          {projects.map((project) => (
            <option key={project.id} value={`project:${project.id}`}>
              {project.name}
            </option>
          ))}
        </optgroup>
      ) : null}
    </SelectField>
  );
}
