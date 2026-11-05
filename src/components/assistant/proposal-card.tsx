"use client";

import { Check, Copy, Pencil, X } from "lucide-react";
import { useRef, useState } from "react";
import { BLOCK_DEFINITIONS } from "@/lib/blocks";
import { PREFERENCE_LABELS, preferenceValueLabel } from "@/lib/preferences";
import type { Proposal } from "@/lib/schemas";
import { PRIORITY_LABELS, formatDueDate, taskBlockOptions } from "@/lib/task-helpers";
import { useWorkspaceData } from "../providers/workspace-data";
import { useNotify } from "../ui/notifications";
import { ReadAloud } from "../ui/read-aloud";
import { useProposalOutcome } from "./proposal-outcome";
import { TaskPlanCard } from "./task-plan-card";

type SimpleProposal = Exclude<Proposal, { type: "task_plan" }>;

export function ProposalCard({ proposal, storageKey }: { proposal: Proposal; storageKey: string }) {
  if (proposal.type === "task_plan") return <TaskPlanCard proposal={proposal} storageKey={storageKey} />;
  return <SimpleProposalCard proposal={proposal} storageKey={storageKey} />;
}

// A suggestion with Apply, Edit, and Dismiss. Nothing changes before Apply.
function SimpleProposalCard({ proposal, storageKey }: { proposal: SimpleProposal; storageKey: string }) {
  const { applyProposal, tasks } = useWorkspaceData();
  const { notify } = useNotify();
  const [outcome, remember] = useProposalOutcome(storageKey);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<SimpleProposal>(proposal);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function apply() {
    if (draft.type === "draft_clarification") {
      try {
        await navigator.clipboard.writeText(draft.message);
        notify("Message copied. Paste it into your usual work channel; MindCraft does not send it.");
      } catch {
        notify("Copy didn't work here. Select the text and copy it manually.", { tone: "error" });
      }
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const message = await applyProposal(draft, storageKey);
      remember("applied");
      notify(message);
    } catch (error) {
      notify(error instanceof Error ? error.message : "That suggestion could not be applied.", { tone: "error" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (outcome === "dismissed") return <p className="mc-hint text-sm">Suggestion dismissed.</p>;

  const targetTask = "task_id" in draft && draft.task_id ? tasks.find((task) => task.id === draft.task_id) : null;

  return (
    <div className="rounded-xl border border-border-strong bg-surface p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">Suggestion · not applied yet</p>
      <p className="mt-1 font-semibold">{draft.summary}</p>
      {targetTask ? <p className="mc-hint text-sm">For: {targetTask.title}</p> : null}

      <div className="mt-2">
        <ProposalBody proposal={draft} editing={editing && outcome === "pending"} onChange={setDraft} />
      </div>

      {outcome === "applied" ? (
        <p className="mt-2 inline-flex items-center gap-1 font-semibold text-secondary" role="status">
          <Check size={16} aria-hidden="true" /> Applied
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={apply} disabled={busy}>
            {draft.type === "draft_clarification" ? (
              <>
                <Copy size={14} aria-hidden="true" /> Copy message
              </>
            ) : (
              <>
                <Check size={14} aria-hidden="true" /> {busy ? "Applying…" : "Apply"}
              </>
            )}
          </button>
          <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" aria-pressed={editing} onClick={() => setEditing((value) => !value)}>
            <Pencil size={14} aria-hidden="true" /> {editing ? "Done editing" : "Edit"}
          </button>
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => remember("dismissed")}>
            <X size={14} aria-hidden="true" /> Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

function ProposalBody({ proposal, editing, onChange }: { proposal: SimpleProposal; editing: boolean; onChange: (next: SimpleProposal) => void }) {
  const { blocks } = useWorkspaceData();
  switch (proposal.type) {
    case "move_task":
      return <p>Moves this task to <span className="font-semibold">{taskBlockOptions(blocks).find((option) => option.id === proposal.task_block_id)?.label ?? "another block"}</span>. Its details and steps stay the same.</p>;
    case "create_tasks":
      return (
        <div className="flex flex-col gap-2">
          <ol className="flex flex-col gap-2">
            {proposal.tasks.map((task, index) => (
              <li key={index} className="rounded-lg bg-surface-muted p-2">
                {editing ? (
                  <div className="flex gap-2">
                    <label className="sr-only" htmlFor={`proposed-task-${index}`}>
                      Task {index + 1} title
                    </label>
                    <input
                      id={`proposed-task-${index}`}
                      className="mc-input"
                      value={task.title}
                      maxLength={200}
                      onChange={(event) =>
                        onChange({ ...proposal, tasks: proposal.tasks.map((item, i) => (i === index ? { ...item, title: event.target.value } : item)) })
                      }
                    />
                    <button
                      type="button"
                      className="mc-btn mc-btn-ghost mc-btn-sm"
                      disabled={proposal.tasks.length === 1}
                      onClick={() => onChange({ ...proposal, tasks: proposal.tasks.filter((_, i) => i !== index) })}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <p className="font-semibold">{task.title}</p>
                )}
                {/* Apply saves these fields too, so the review must show all of them. */}
                {editing && (task.description || task.expected_result) ? (
                  <div className="mt-2 flex flex-col gap-2">
                    {(["description", "expected_result"] as const).map((field) =>
                      task[field] ? (
                        <div key={field} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 text-sm">
                            {field === "description" ? "Instructions" : "Expected result"}: {task[field]}
                          </span>
                          <button
                            type="button"
                            className="mc-btn mc-btn-ghost mc-btn-sm"
                            aria-label={`Remove ${field === "description" ? "instructions" : "expected result"} from task ${index + 1}`}
                            onClick={() =>
                              onChange({ ...proposal, tasks: proposal.tasks.map((item, i) => (i === index ? { ...item, [field]: undefined } : item)) })
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ) : null,
                    )}
                  </div>
                ) : (
                  <>
                    {task.description ? <p className="mt-1 text-sm">Instructions: {task.description}</p> : null}
                    {task.expected_result ? <p className="mt-1 text-sm">Expected result: {task.expected_result}</p> : null}
                  </>
                )}
                <div className="mt-1 flex flex-wrap gap-1.5 text-sm">
                  <span className="mc-chip">{task.due_date ? formatDueDate(task.due_date) : "No deadline given"}</span>
                  {task.priority ? <span className="mc-chip">{PRIORITY_LABELS[task.priority]}</span> : null}
                  {task.steps?.length ? <span className="mc-chip">{task.steps.length} steps</span> : null}
                </div>
              </li>
            ))}
          </ol>
          {proposal.order_explanation ? <p className="mc-hint text-sm">Suggested order: {proposal.order_explanation}</p> : null}
        </div>
      );
    case "propose_steps":
      return (
        <>
        <ReadAloud text={proposal.steps.join(". ")} label="Read these steps aloud" />
        <ol className="flex list-decimal flex-col gap-1 pl-5">
          {proposal.steps.map((step, index) => (
            <li key={index}>
              {editing ? (
                <input
                  className="mc-input"
                  aria-label={`Step ${index + 1}`}
                  value={step}
                  maxLength={300}
                  onChange={(event) => onChange({ ...proposal, steps: proposal.steps.map((item, i) => (i === index ? event.target.value : item)) })}
                />
              ) : (
                step
              )}
            </li>
          ))}
        </ol>
        </>
      );
    case "record_missing_info":
      return editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="mc-input"
            rows={3}
            aria-label="What information is missing"
            value={proposal.missing}
            maxLength={1000}
            onChange={(event) => onChange({ ...proposal, missing: event.target.value })}
          />
          <input
            className="mc-input"
            aria-label="Who or what could help"
            placeholder="Who or what could help (optional)"
            value={proposal.support ?? ""}
            maxLength={500}
            onChange={(event) => onChange({ ...proposal, support: event.target.value })}
          />
        </div>
      ) : (
        <div className="rounded-lg bg-surface-muted p-2">
          <p className="whitespace-pre-wrap">{proposal.missing}</p>
          {proposal.support ? <p className="mc-hint mt-1">Could help: {proposal.support}</p> : null}
        </div>
      );
    case "suggest_blocks":
      return (
        <ul className="flex flex-col gap-1">
          {proposal.blocks.map((block, index) => (
            <li key={index} className="flex items-center justify-between gap-2">
              <span>
                <span className="font-semibold">{BLOCK_DEFINITIONS[block.block_type].label}</span>
                {block.reason ? <span className="mc-hint"> · {block.reason}</span> : null}
              </span>
              {editing && proposal.blocks.length > 1 ? (
                <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => onChange({ ...proposal, blocks: proposal.blocks.filter((_, i) => i !== index) })}>
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      );
    case "suggest_layout":
      return (
        <ul className="flex flex-col gap-1">
          {proposal.items.map((item, index) => (
            <li key={index}>
              {BLOCK_DEFINITIONS[item.block_type].label} · {item.size}
            </li>
          ))}
        </ul>
      );
    case "suggest_preferences":
      return (
        <ul className="flex flex-col gap-1">
          {Object.entries(proposal.changes).map(([key, value]) => (
            <li key={key}>
              {PREFERENCE_LABELS[key as keyof typeof PREFERENCE_LABELS] ?? key}: <span className="font-semibold">{preferenceValueLabel(key, value)}</span>
            </li>
          ))}
        </ul>
      );
    case "draft_clarification":
      return editing ? (
        <textarea
          className="mc-input"
          rows={5}
          aria-label="Message draft"
          value={proposal.message}
          maxLength={1500}
          onChange={(event) => onChange({ ...proposal, message: event.target.value })}
        />
      ) : (
        <p className="whitespace-pre-wrap rounded-lg bg-surface-muted p-2">{proposal.message}</p>
      );
  }
}
