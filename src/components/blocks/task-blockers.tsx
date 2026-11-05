"use client";

import { Check, CircleHelp, Pencil, RotateCcw } from "lucide-react";
import { NO_SUPPORT_YET, taskBlockers } from "@/lib/task-helpers";
import type { Task } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { useNotify } from "../ui/notifications";

// Missing information is stored as a help request linked to the task, the record the
// Check-in block also shows. Task guide and Focus Mode both read it from here.
export function TaskBlockers({ task }: { task: Task }) {
  const { checkIns, checkInActions } = useWorkspaceData();
  const { openMissingInfo } = useWorkspaceUI();
  const { announce } = useNotify();
  const { open, resolved } = taskBlockers(checkIns, task.id);

  async function setStatus(id: string, help_status: "open" | "resolved") {
    if (await checkInActions.update(id, { help_status })) announce(help_status === "resolved" ? "Marked as resolved." : "Reopened.");
  }

  return (
    <div className="flex flex-col gap-2">
      {open.length ? (
        <>
          <h4 className="font-semibold">Missing information</h4>
          <ul className="flex flex-col gap-2">
            {open.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-border-strong p-3 text-sm">
                <p className="whitespace-pre-wrap font-semibold">{entry.blocking}</p>
                {entry.support && entry.support !== NO_SUPPORT_YET ? (
                  <p className="mt-1 whitespace-pre-wrap">
                    <span className="font-semibold">Could help:</span> {entry.support}
                  </p>
                ) : null}
                {entry.help_status === "waiting" ? <span className="mc-chip mt-1">Waiting</span> : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => setStatus(entry.id, "resolved")}>
                    <Check size={14} aria-hidden="true" /> Mark resolved
                  </button>
                  <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => openMissingInfo(task.id, entry.id)}>
                    <Pencil size={14} aria-hidden="true" /> Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {resolved.length ? (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold">Resolved ({resolved.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {resolved.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-muted p-2">
                <span className="min-w-0 whitespace-pre-wrap">{entry.blocking}</span>
                <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => setStatus(entry.id, "open")}>
                  <RotateCcw size={14} aria-hidden="true" /> Reopen
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm self-start" onClick={() => openMissingInfo(task.id)}>
        <CircleHelp size={16} aria-hidden="true" /> {open.length ? "Add more missing information" : "Missing information"}
      </button>
    </div>
  );
}
