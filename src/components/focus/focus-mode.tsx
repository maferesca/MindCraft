"use client";

import { ExternalLink, LogOut, Sparkles, Timer } from "lucide-react";
import { useState } from "react";
import { isHttpUrl } from "@/lib/schemas";
import { openTasks } from "@/lib/task-helpers";
import { CurrentStep } from "../blocks/next-step-block";
import { FocusTimerBlock } from "../blocks/focus-timer-block";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";

// A temporary, simpler view of one task. It replaces the grid on screen only;
// the saved layout is untouched, so exiting shows the workspace exactly as before.
export function FocusMode() {
  const { tasks, notes } = useWorkspaceData();
  const { focusTaskId, setFocusTaskId, exitFocus, openAssistant } = useWorkspaceUI();
  const [showTimer, setShowTimer] = useState(false);
  const task = tasks.find((item) => item.id === focusTaskId) ?? null;
  const linkedNotes = task ? notes.filter((note) => note.task_id === task.id) : [];
  // Links saved before validation existed may not be real web addresses.
  const sourceLink = task?.source_link && isHttpUrl(task.source_link) ? task.source_link : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-text-muted">Focus Mode</h2>
        <button
          type="button"
          className="mc-btn mc-btn-secondary"
          onClick={() => {
            exitFocus();
            document.getElementById("main")?.focus({ preventScroll: true });
          }}
        >
          <LogOut size={16} aria-hidden="true" /> Exit Focus Mode
        </button>
      </div>

      <div className="mc-card p-5">
        <label htmlFor="focus-task" className="mc-label">
          Task
        </label>
        <select id="focus-task" className="mc-input" value={task?.id ?? ""} onChange={(event) => setFocusTaskId(event.target.value || null)}>
          <option value="">Choose a task…</option>
          {openTasks(tasks).map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
          {task && task.status === "done" ? <option value={task.id}>{task.title} (done)</option> : null}
        </select>

        {task ? (
          <div className="mt-4 flex flex-col gap-4">
            <h3 className="text-2xl font-bold">{task.title}</h3>
            {task.expected_result ? (
              <p>
                <span className="font-semibold">Expected result:</span> {task.expected_result}
              </p>
            ) : null}
            <CurrentStep task={task} />
            {sourceLink || linkedNotes.length ? (
              <div>
                <h4 className="font-semibold">Resources</h4>
                <ul className="mt-1 flex flex-col gap-1">
                  {sourceLink ? (
                    <li>
                      <a href={sourceLink} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-primary underline underline-offset-4">
                        Source link <ExternalLink size={14} aria-hidden="true" />
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    </li>
                  ) : null}
                  {linkedNotes.map((note) => (
                    <li key={note.id} className="rounded-lg bg-surface-muted p-2">
                      {note.title ? <span className="block font-semibold">{note.title}</span> : null}
                      <span className="line-clamp-3 whitespace-pre-wrap">{note.body}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => openAssistant({ mode: "help_me_start", taskId: task.id, autoSend: true })}>
                <Sparkles size={16} aria-hidden="true" /> Help me start
              </button>
              <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" aria-expanded={showTimer} onClick={() => setShowTimer((value) => !value)}>
                <Timer size={16} aria-hidden="true" /> {showTimer ? "Hide timer" : "Use a timer (optional)"}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {showTimer ? (
        <div className="mc-card p-5">
          <FocusTimerBlock compact />
        </div>
      ) : null}
    </div>
  );
}
