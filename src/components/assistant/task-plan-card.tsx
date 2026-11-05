"use client";

import { Check, Pencil, Play, Split, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BLOCK_CAPABILITIES, PLACEMENT_LABELS, blockPlacement } from "@/lib/block-capabilities";
import { BLOCK_DEFINITIONS, BLOCK_ORDER } from "@/lib/blocks";
import { proposalSchema, TASK_PLAN_FIELDS, type Proposal } from "@/lib/schemas";
import { PRIORITY_LABELS, formatDueDate } from "@/lib/task-helpers";
import { isVagueTitle, normalizeTitle, proposalRecordId } from "@/lib/task-plan";
import type { BlockType } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { useNotify } from "../ui/notifications";
import { ReadAloud } from "../ui/read-aloud";
import { useProposalOutcome } from "./proposal-outcome";

export type TaskPlanProposal = Extract<Proposal, { type: "task_plan" }>;
type PlanField = (typeof TASK_PLAN_FIELDS)[number];

const OPTIONAL_TEXT = "Not specified";

function PlanRow({ label, source, children }: { label: string; source?: "stated" | "suggested"; children: React.ReactNode }) {
  return (
    <div>
      <dt className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-text-muted">
        {label}
        {source ? <span className="mc-chip px-1.5 py-0 text-[0.6875rem] font-semibold">{source === "stated" ? "From you" : "Suggested"}</span> : null}
      </dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

// A compact, editable plan. Nothing is saved, moved, or added until Confirm.
export function TaskPlanCard({ proposal, storageKey }: { proposal: TaskPlanProposal; storageKey: string }) {
  const { applyProposal, blocks, tasks, preferences } = useWorkspaceData();
  const { creativeMode, enterFocus, closeAssistant, openAssistant } = useWorkspaceUI();
  const { notify } = useNotify();
  const [outcome, remember] = useProposalOutcome(storageKey);
  const [draft, setDraft] = useState(proposal);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  // State updates too late to stop a second click in the same moment.
  const busyRef = useRef(false);
  const [newTaskId, setNewTaskId] = useState<string | null>(null);
  const blockSelectId = useId();

  useEffect(() => {
    let active = true;
    proposalRecordId(storageKey).then((id) => {
      if (active) setNewTaskId(id);
    });
    return () => {
      active = false;
    };
  }, [storageKey]);

  if (outcome === "dismissed") return <p className="mc-hint text-sm">Suggestion dismissed. Nothing was changed.</p>;

  const { task } = draft;
  const targetTask = draft.task_id ? tasks.find((item) => item.id === draft.task_id) : null;
  const savedTask = tasks.find((item) => item.id === (draft.task_id ?? newTaskId));
  const blockType = draft.recommended_block?.block_type;
  const placement = blockType ? blockPlacement(blocks, blockType) : null;
  const repeatedTitle = !draft.task_id && outcome === "pending" && tasks.some((item) => item.status !== "done" && normalizeTitle(item.title) === normalizeTitle(task.title));
  const longerThanSession = (task.estimated_minutes ?? 0) > preferences.workMinutes * 2;
  const pending = outcome === "pending";

  const sourceOf = (field: PlanField) => (draft.stated_by_user?.includes(field) ? "stated" : "suggested");

  function setField(field: PlanField, value: string) {
    setDraft((current) => ({
      ...current,
      task: { ...current.task, [field]: value },
      // Text the person wrote is theirs, not a suggestion.
      stated_by_user: [...new Set([...(current.stated_by_user ?? []), field])],
    }));
  }

  function setMinutes(value: string) {
    setDraft((current) => {
      const next = { ...current.task };
      if (value.trim()) next.estimated_minutes = Number(value);
      else delete next.estimated_minutes;
      return { ...current, task: next };
    });
  }

  function chooseBlock(value: string) {
    setDraft((current) => {
      const next = { ...current };
      if (!value) delete next.recommended_block;
      else {
        const type = value as BlockType;
        // Only the model's own reasons are reused. Otherwise the real capability explains it.
        const known = [proposal.recommended_block, proposal.alternative_block].find((choice) => choice?.block_type === type);
        next.recommended_block = known ?? { block_type: type };
      }
      return next;
    });
  }

  async function confirm() {
    if (busyRef.current) return;
    const parsed = proposalSchema.safeParse(draft);
    if (!parsed.success) {
      notify("Check the title, the first action, and the estimated minutes (1 to 600).", { tone: "error" });
      return;
    }
    if (creativeMode && placement && placement !== "placed") {
      notify("Save or cancel Creative Mode first, so the new block is not lost.", { tone: "error" });
      return;
    }
    busyRef.current = true;
    setBusy(true);
    try {
      const message = await applyProposal(parsed.data, storageKey);
      remember("applied");
      setEditing(false);
      notify(message);
    } catch (error) {
      notify(error instanceof Error ? error.message : "That suggestion could not be applied.", { tone: "error" });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const confirmLabel = busy
    ? "Saving…"
    : repeatedTitle
      ? "Add anyway"
      : blockType && placement !== "placed"
        ? `Confirm and ${placement === "hidden" ? "show" : "add"} ${BLOCK_DEFINITIONS[blockType].label}`
        : "Confirm and apply";

  return (
    <div className="rounded-xl border border-border-strong bg-surface p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-text-muted">{pending ? "Suggestion · not applied yet" : "Task plan"}</p>
      <p className="mt-1 font-semibold">{draft.summary}</p>
      {targetTask ? <p className="mc-hint text-sm">For: {targetTask.title}. Your instructions and filled fields stay as they are.</p> : null}

      <dl className="mt-2 flex flex-col gap-2">
        <PlanRow label="Task" source={sourceOf("title")}>
          {editing ? (
            <input className="mc-input" aria-label="Task title" maxLength={200} value={task.title} onChange={(event) => setField("title", event.target.value)} />
          ) : (
            <span className="font-semibold">{task.title}</span>
          )}
          {pending && isVagueTitle(task.title) ? <p className="mc-hint text-sm">This title is vague. Edit it to name what will be finished.</p> : null}
        </PlanRow>
        <PlanRow label="Deliverable" source={sourceOf("deliverable")}>
          {editing ? (
            <input className="mc-input" aria-label="Deliverable" maxLength={1000} value={task.deliverable ?? ""} onChange={(event) => setField("deliverable", event.target.value)} />
          ) : (
            (task.deliverable ?? OPTIONAL_TEXT)
          )}
        </PlanRow>
        <PlanRow label="Done when" source={sourceOf("done_when")}>
          {editing ? (
            <input className="mc-input" aria-label="Completion criterion" maxLength={500} value={task.done_when ?? ""} onChange={(event) => setField("done_when", event.target.value)} />
          ) : (
            (task.done_when ?? OPTIONAL_TEXT)
          )}
        </PlanRow>
        <PlanRow label="Estimated time block" source="suggested">
          {editing ? (
            <input
              className="mc-input"
              aria-label="Estimated minutes"
              type="number"
              min={1}
              max={600}
              step={1}
              value={task.estimated_minutes ?? ""}
              onChange={(event) => setMinutes(event.target.value)}
            />
          ) : task.estimated_minutes ? (
            `About ${task.estimated_minutes} min. This is a planning estimate, not a promise.`
          ) : (
            OPTIONAL_TEXT
          )}
        </PlanRow>
        <PlanRow label="First action" source={sourceOf("first_action")}>
          {editing ? (
            <textarea className="mc-input" rows={2} aria-label="First action" maxLength={500} value={task.first_action} onChange={(event) => setField("first_action", event.target.value)} />
          ) : (
            <>
              {task.first_action} <ReadAloud text={task.first_action} label="Read the first action aloud" />
            </>
          )}
        </PlanRow>
      </dl>

      {task.due_date || task.priority ? (
        <div className="mt-2 flex flex-wrap gap-1.5 text-sm">
          {task.due_date ? <span className="mc-chip">{formatDueDate(task.due_date)}</span> : null}
          {task.priority ? <span className="mc-chip">{PRIORITY_LABELS[task.priority]}</span> : null}
        </div>
      ) : null}

      {pending && (draft.split_suggestion || longerThanSession) ? (
        <div className="mt-2 rounded-lg bg-surface-muted p-2 text-sm">
          <p>{draft.split_suggestion ?? `This is longer than two of your ${preferences.workMinutes}-minute sessions. You could split it.`}</p>
          <button
            type="button"
            className="mc-btn mc-btn-secondary mc-btn-sm mt-2"
            onClick={() => openAssistant({ mode: "chat", autoSend: true, message: `"${task.title}" looks too big for one session. Could you split it into smaller tasks?` })}
          >
            <Split size={14} aria-hidden="true" /> Split it
          </button>
        </div>
      ) : null}

      <div className="mt-3 border-t border-border pt-2">
        <label htmlFor={blockSelectId} className="text-xs font-bold text-text-muted">
          Workspace block
        </label>
        {pending ? (
          <select id={blockSelectId} className="mc-input mt-0.5" value={blockType ?? ""} onChange={(event) => chooseBlock(event.target.value)}>
            <option value="">No workspace block</option>
            {BLOCK_ORDER.map((type) => (
              <option key={type} value={type}>
                {BLOCK_DEFINITIONS[type].label}
                {blockPlacement(blocks, type) === "placed" ? "" : blockPlacement(blocks, type) === "hidden" ? " (hidden)" : " (not added yet)"}
              </option>
            ))}
          </select>
        ) : (
          <p id={blockSelectId} className="font-semibold">
            {blockType ? BLOCK_DEFINITIONS[blockType].label : "No workspace block"}
          </p>
        )}
        {blockType ? (
          <>
            <p className="mt-1 text-sm">{draft.recommended_block?.reason || BLOCK_CAPABILITIES[blockType].purpose}</p>
            {pending && placement ? <p className="mc-hint text-sm">{PLACEMENT_LABELS[placement]}</p> : null}
            {pending && blockType === "calendar" && !task.due_date && !targetTask?.due_date ? (
              <p className="mc-hint text-sm">Without a deadline, this task appears on the Calendar only if you add a work session.</p>
            ) : null}
            {pending && blockType === "next_step" ? <p className="mc-hint text-sm">The Task guide will open this task.</p> : null}
          </>
        ) : draft.block_limitation ? (
          <p className="mt-1 text-sm">{draft.block_limitation}</p>
        ) : null}
        {pending && proposal.alternative_block && proposal.alternative_block.block_type !== blockType ? (
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm mt-1" onClick={() => chooseBlock(proposal.alternative_block!.block_type)}>
            Use {BLOCK_DEFINITIONS[proposal.alternative_block.block_type].label} instead
            {proposal.alternative_block.reason ? `: ${proposal.alternative_block.reason}` : ""}
          </button>
        ) : null}
      </div>

      {pending ? (
        <>
          {repeatedTitle ? <p className="mc-hint mt-2 text-sm">You already have an open task with this title.</p> : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={confirm} disabled={busy}>
              <Check size={14} aria-hidden="true" /> {confirmLabel}
            </button>
            <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" aria-pressed={editing} onClick={() => setEditing((value) => !value)}>
              <Pencil size={14} aria-hidden="true" /> {editing ? "Done editing" : "Edit"}
            </button>
            <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => remember("dismissed")}>
              <X size={14} aria-hidden="true" /> Dismiss
            </button>
          </div>
        </>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="inline-flex items-center gap-1 font-semibold text-secondary" role="status">
            <Check size={16} aria-hidden="true" /> Applied
          </p>
          {savedTask && savedTask.status !== "done" ? (
            <button
              type="button"
              className="mc-btn mc-btn-secondary mc-btn-sm"
              onClick={() => {
                closeAssistant();
                enterFocus(savedTask.id);
              }}
            >
              <Play size={14} aria-hidden="true" /> Start first action
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
