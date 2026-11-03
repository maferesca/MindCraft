"use client";

import { Copy, Sparkles } from "lucide-react";
import { useState } from "react";
import { clarificationTemplate } from "@/lib/task-helpers";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { TextAreaField } from "../ui/field";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";

const OPTIONS = ["Deadline", "Instructions or example", "File or access", "Expected delivery format", "Priority"];

// Helps draft a short clarification message. Mindcraft never sends it:
// the user edits it and copies it into their own work channel.
export function MissingInfoDialog() {
  const { missingInfoTaskId, closeMissingInfo, openAssistant } = useWorkspaceUI();
  const { tasks, updateTask } = useWorkspaceData();
  const { notify } = useNotify();
  const task = tasks.find((item) => item.id === missingInfoTaskId);
  const [selected, setSelected] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [draft, setDraft] = useState("");

  if (!task) return null;

  function toggle(option: string) {
    setSelected((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));
  }

  function close() {
    setSelected([]);
    setOther("");
    setDraft("");
    closeMissingInfo();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft);
      notify("Message copied. Paste it into your usual work channel.");
    } catch {
      notify("Copy didn't work in this browser. Select the text and copy it manually.", { tone: "error" });
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && close()} title="Missing information" description={`For "${task.title}"`}>
      <fieldset>
        <legend className="mc-label">What is missing?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {OPTIONS.map((option) => (
            <label key={option} className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3">
              <input type="checkbox" className="h-5 w-5" checked={selected.includes(option)} onChange={() => toggle(option)} />
              {option}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-3">
        <TextAreaField label="Other" optional rows={2} value={other} maxLength={300} onChange={(event) => setOther(event.target.value)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="mc-btn mc-btn-primary" onClick={() => setDraft(clarificationTemplate(task.title, selected, other))}>
          Draft a message
        </button>
        <button
          type="button"
          className="mc-btn mc-btn-secondary"
          onClick={() => {
            const missing = [...selected, other.trim()].filter(Boolean);
            close();
            openAssistant({
              mode: "missing_information",
              taskId: task.id,
              autoSend: true,
              message: `I need to ask for: ${missing.join(", ") || "more details"}. Please draft a short clarification message.`,
            });
          }}
        >
          <Sparkles size={16} aria-hidden="true" /> Ask the assistant instead
        </button>
      </div>

      {draft ? (
        <div className="mt-4">
          <TextAreaField
            label="Your message"
            hint="Edit it as you like. Mindcraft does not send messages; copy it into your usual channel."
            rows={5}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {task.status !== "blocked" ? (
              <button type="button" className="mc-btn mc-btn-ghost" onClick={() => updateTask(task.id, { status: "blocked" })}>
                Mark task as blocked
              </button>
            ) : null}
            <button type="button" className="mc-btn mc-btn-primary" onClick={copy}>
              <Copy size={16} aria-hidden="true" /> Copy message
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
