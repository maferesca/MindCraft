"use client";

import { format, parseISO } from "date-fns";
import { useState } from "react";
import { localDateString } from "@/lib/dates";
import { STATUS_LABELS } from "@/lib/task-helpers";
import type { CheckIn } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useNotify } from "../ui/notifications";
import { CheckInForm } from "./check-in-form";
import { useTimezone } from "./use-today";

const HELP_STATUS_LABELS = { open: "Open", waiting: "Waiting", resolved: "Resolved" };

export function CheckInBlock() {
  const { checkIns } = useWorkspaceData();
  const [form, setForm] = useState<{ kind: CheckIn["kind"]; entry: CheckIn | null } | null>(null);
  const sorted = [...checkIns].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={() => setForm({ kind: "progress", entry: null })}>
          Progress update
        </button>
        <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => setForm({ kind: "help", entry: null })}>
          I need help
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="mc-hint">No entries yet. Write a progress update or ask for help.</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-2 overflow-y-auto" aria-label="Check-in entries">
          {sorted.map((entry) => (
            <EntryCard key={entry.id} entry={entry} onEdit={() => setForm({ kind: entry.kind, entry })} />
          ))}
        </ul>
      )}
      {form ? <CheckInForm key={form.entry?.id ?? form.kind} kind={form.kind} entry={form.entry} onClose={() => setForm(null)} /> : null}
    </div>
  );
}

function EntryCard({ entry, onEdit }: { entry: CheckIn; onEdit: () => void }) {
  const { tasks, checkInActions } = useWorkspaceData();
  const timezone = useTimezone();
  const { announce } = useNotify();
  const [followUp, setFollowUp] = useState("");
  const task = tasks.find((item) => item.id === entry.task_id);
  const followUps = entry.follow_ups ?? [];
  const help = entry.kind === "help";

  async function addFollowUp() {
    const text = followUp.trim();
    if (!text) return;
    const ok = await checkInActions.update(entry.id, { follow_ups: [...followUps, { text: text.slice(0, 1000), created_at: new Date().toISOString() }] });
    if (ok) {
      setFollowUp("");
      announce("Follow-up saved.");
    }
  }

  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border p-2 text-sm">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold">{help ? "Help request" : "Progress update"}</span>
        <span className="mc-chip">Draft</span>
        <span className="mc-hint">{format(parseISO(localDateString(timezone, new Date(entry.created_at))), "d MMM yyyy")}</span>
      </div>
      {task ? (
        <p>
          Task: {task.title} <span className="mc-hint">· {STATUS_LABELS[task.status]}</span>
        </p>
      ) : null}
      {help ? (
        <>
          <p className="whitespace-pre-wrap">
            <span className="font-semibold">Blocking:</span> {entry.blocking}
          </p>
          <p className="whitespace-pre-wrap">
            <span className="font-semibold">Support needed:</span> {entry.support}
          </p>
        </>
      ) : (
        <>
          {entry.completed_text ? (
            <p className="whitespace-pre-wrap">
              <span className="font-semibold">Completed:</span> {entry.completed_text}
            </p>
          ) : null}
          {entry.next_text ? (
            <p className="whitespace-pre-wrap">
              <span className="font-semibold">Next:</span> {entry.next_text}
            </p>
          ) : null}
        </>
      )}
      {followUps.map((item, index) => (
        <p key={index} className="whitespace-pre-wrap border-l-2 border-border-strong pl-2">
          {item.text}
        </p>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        {help ? (
          <label>
            <span className="sr-only">Status</span>
            <select
              className="mc-input min-h-9 w-auto py-1"
              value={entry.help_status ?? "open"}
              onChange={(event) => checkInActions.update(entry.id, { help_status: event.target.value as CheckIn["help_status"] })}
            >
              {Object.entries(HELP_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className="mc-btn mc-btn-ghost mc-btn-sm"
          onClick={async () => {
            if (window.confirm("Delete this draft?") && (await checkInActions.remove(entry.id))) announce("Draft deleted.");
          }}
        >
          Delete
        </button>
      </div>
      {help ? (
        <div className="flex gap-2">
          <label className="sr-only" htmlFor={`follow-up-${entry.id}`}>
            Add a follow-up
          </label>
          <input id={`follow-up-${entry.id}`} className="mc-input min-h-9 py-1" placeholder="Add a follow-up…" maxLength={1000} value={followUp} onChange={(event) => setFollowUp(event.target.value)} />
          <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm shrink-0" disabled={!followUp.trim()} onClick={addFollowUp}>
            Add
          </button>
        </div>
      ) : null}
    </li>
  );
}
