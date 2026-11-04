"use client";

import { ExternalLink, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { resourceInputSchema } from "@/lib/schemas";
import type { Resource, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { ChoiceGroup } from "../ui/choice-group";
import { TextAreaField, TextField } from "../ui/field";
import { IconButton } from "../ui/icon-button";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";
import { LinkSelect, linkKey, parseLink } from "./link-select";
import { useBlockConfig } from "./use-block-config";

export function ResourcesBlock({ block }: { block: WorkspaceBlock }) {
  const { resources, tasks, projects } = useWorkspaceData();
  const [config, setConfig] = useBlockConfig(block, { view: "list" as "list" | "cards", filter: "all" });
  const [editing, setEditing] = useState<Resource | "new" | null>(null);

  const visible = resources
    .filter((resource) => {
      if (config.filter === "all") return true;
      if (config.filter === "favorites") return resource.favorite;
      const link = parseLink(config.filter);
      return link.task_id ? resource.task_id === link.task_id : resource.project_id === link.project_id;
    })
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name));

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={() => setEditing("new")}>
          <Plus size={16} aria-hidden="true" /> Add link
        </button>
        <ChoiceGroup label="Resource view" value={config.view} options={[["list", "List"], ["cards", "Cards"]]} onChange={(view) => setConfig({ view })} />
        <label className="sr-only" htmlFor={`resource-filter-${block.id}`}>
          Filter resources
        </label>
        <select id={`resource-filter-${block.id}`} className="mc-input min-h-9 w-auto max-w-44 py-1 text-sm" value={config.filter} onChange={(event) => setConfig({ filter: event.target.value })}>
          <option value="all">All</option>
          <option value="favorites">Favorites</option>
          {projects.length ? (
            <optgroup label="Projects">
              {projects.map((project) => (
                <option key={project.id} value={`project:${project.id}`}>
                  {project.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {tasks.length ? (
            <optgroup label="Tasks">
              {tasks.map((task) => (
                <option key={task.id} value={`task:${task.id}`}>
                  {task.title}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="mc-hint">{resources.length ? "No resources match this filter." : "No resources yet. Add your first link."}</p>
      ) : (
        <ul className={`min-h-0 overflow-y-auto ${config.view === "cards" ? "grid grid-cols-[repeat(auto-fill,minmax(min(100%,11rem),1fr))] gap-2" : "flex flex-col gap-1"}`} aria-label="Resources">
          {visible.map((resource) => (
            <ResourceItem key={resource.id} resource={resource} card={config.view === "cards"} onEdit={() => setEditing(resource)} />
          ))}
        </ul>
      )}
      {editing ? <ResourceDialog key={editing === "new" ? "new" : editing.id} resource={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function ResourceItem({ resource, card, onEdit }: { resource: Resource; card: boolean; onEdit: () => void }) {
  const { tasks, projects, resourceActions } = useWorkspaceData();
  const { announce } = useNotify();
  const linked = tasks.find((task) => task.id === resource.task_id)?.title ?? projects.find((project) => project.id === resource.project_id)?.name;

  return (
    <li className={`rounded-lg border border-border p-2 ${card ? "flex flex-col gap-1" : "flex items-center gap-2"}`}>
      <div className="min-w-0 flex-1">
        <a href={resource.url} target="_blank" rel="noreferrer noopener" className="inline-flex max-w-full items-center gap-1 font-semibold text-primary underline underline-offset-4">
          <span className="truncate">{resource.name}</span> <ExternalLink size={13} aria-hidden="true" className="shrink-0" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <p className="mc-hint">Link{linked ? ` · ${linked}` : ""}</p>
        {card && resource.description ? <p className="line-clamp-2 text-sm">{resource.description}</p> : null}
      </div>
      <div className="flex shrink-0 items-center">
        <IconButton
          size="sm"
          label={resource.favorite ? `Remove ${resource.name} from favorites` : `Add ${resource.name} to favorites`}
          aria-pressed={resource.favorite}
          icon={<Star size={16} fill={resource.favorite ? "currentColor" : "none"} />}
          onClick={() => resourceActions.update(resource.id, { favorite: !resource.favorite })}
        />
        <IconButton size="sm" label={`Edit ${resource.name}`} icon={<Pencil size={16} />} onClick={onEdit} />
        <IconButton
          size="sm"
          label={`Remove ${resource.name}`}
          icon={<Trash2 size={16} />}
          onClick={async () => {
            if (!window.confirm(`Remove "${resource.name}" from Mindcraft? The linked page is not affected.`)) return;
            if (await resourceActions.remove(resource.id)) announce("Resource removed.");
          }}
        />
      </div>
    </li>
  );
}

function ResourceDialog({ resource, onClose }: { resource: Resource | null; onClose: () => void }) {
  const { resourceActions } = useWorkspaceData();
  const { announce } = useNotify();
  const [values, setValues] = useState({ name: resource?.name ?? "", url: resource?.url ?? "", description: resource?.description ?? "" });
  const [link, setLink] = useState(resource ? linkKey(resource) : "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof values) => (event: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: event.target.value }));

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = resourceInputSchema.safeParse({ ...values, ...parseLink(link) });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    const input = parsed.data as Partial<Resource>;
    const ok = resource ? await resourceActions.update(resource.id, input) : await resourceActions.create({ ...input, favorite: false });
    if (ok) {
      announce("Resource saved.");
      onClose();
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={resource ? "Edit link" : "Add link"}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField label="Name" value={values.name} error={errors.name} maxLength={200} autoFocus onChange={set("name")} />
        <TextField label="URL" type="url" placeholder="https://…" value={values.url} error={errors.url} onChange={set("url")} />
        <TextAreaField label="Description" optional value={values.description} maxLength={1000} onChange={set("description")} />
        <LinkSelect value={link} onChange={setLink} />
        <div className="flex justify-end gap-2">
          <button type="button" className="mc-btn mc-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="mc-btn mc-btn-primary">
            Save
          </button>
        </div>
      </form>
    </Modal>
  );
}
