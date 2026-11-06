import { BLOCK_DEFINITIONS, BLOCK_ORDER } from "./blocks";
import type { BlockType, WorkspaceBlock } from "./types";

export interface BlockCapability {
  type: BlockType;
  purpose: string;
  supportedData: string[];
  actions: string[];
  appropriateWhen: string[];
  limits: string[];
}

// What each block really does today. The assistant receives this text, so it
// must describe working features only. Update it whenever a block changes.
export const BLOCK_CAPABILITIES: Record<BlockType, BlockCapability> = {
  task_list: {
    type: "task_list",
    purpose: "Keep the tasks of one topic together and decide what comes next.",
    supportedData: ["tasks", "status", "priority", "deadline", "estimated minutes"],
    actions: ["hold its own tasks under its own title", "move tasks to another task block", "add, edit, and delete tasks", "show a list or a board", "filter by date or completion", "sort by deadline, priority, or title", "change status"],
    appropriateWhen: ["the person needs an overview", "the work needs to be compared or ordered with other tasks", "no other block fits better"],
    limits: ["shows no step-by-step guidance for one task"],
  },
  calendar: {
    type: "calendar",
    purpose: "See deadlines, events, and scheduled work over time.",
    supportedData: ["task deadlines", "events", "work sessions linked to a task"],
    actions: ["show month, week, day, or agenda views", "add and edit events and work sessions", "filter by project or type"],
    appropriateWhen: ["the work has a deadline", "the person wants to choose when to do it", "the blocker is finding time"],
    limits: ["a task without a deadline appears only if the person adds a work session", "does not sync with Google or Outlook", "the assistant cannot schedule sessions"],
  },
  next_step: {
    type: "next_step",
    purpose: "Guide one task from start to finish.",
    supportedData: ["instructions", "expected deliverable", "ordered steps", "Before submitting checklist", "linked resources", "missing information"],
    actions: ["show steps at the Quick Start, Guided, or Detailed level", "show steps as a list or a visual flow", "read steps aloud", "check off steps", "check off review items", "record and resolve missing information", "mark the task done"],
    appropriateWhen: ["the person knows the task but not how to proceed", "the task has several steps", "the deliverable must be reviewed before it is finished"],
    limits: ["shows one task at a time"],
  },
  focus_timer: {
    type: "focus_timer",
    purpose: "Time a work session.",
    supportedData: ["countdown or stopwatch session", "optional break"],
    actions: ["start, pause, and stop a timer", "set work and break minutes", "play an optional sound"],
    appropriateWhen: ["the person has decided what to do and wants a time-boxed session", "the person says a time limit helps"],
    limits: ["does not guide the work", "do not recommend it if the person declined timers"],
  },
  notes: {
    type: "notes",
    purpose: "Capture text that is not a task.",
    supportedData: ["plain text", "bullets", "checklists", "a link to one task or project"],
    actions: ["write and autosave notes", "pin notes", "link a note to a task or project"],
    appropriateWhen: ["the deliverable starts as thinking or rough writing", "the person needs to capture ideas, meeting notes, or findings"],
    limits: ["cannot format rich text or attach files"],
  },
  resources: {
    type: "resources",
    purpose: "Keep useful links together.",
    supportedData: ["named web links", "descriptions", "favorites", "a link to one task or project"],
    actions: ["save links", "mark favorites", "filter by project or task", "show a list or cards"],
    appropriateWhen: ["the blocker is finding reference material", "the task depends on web pages or shared documents"],
    limits: ["stores links only and cannot upload files"],
  },
  check_in: {
    type: "check_in",
    purpose: "Write progress updates and help requests as private drafts.",
    supportedData: ["completed work", "next work", "blockers", "support needed", "Open, Waiting, or Resolved status"],
    actions: ["write a progress draft", "write a help request", "add follow-ups", "track help request status"],
    appropriateWhen: ["the blocker depends on another person", "the person needs to prepare an update or request help"],
    limits: ["cannot send or share anything: entries stay private drafts"],
  },
};

export type BlockPlacement = "placed" | "hidden" | "available";

// Decided from the saved workspace, never from the model's reply.
export function blockPlacement(blocks: Array<Pick<WorkspaceBlock, "block_type" | "hidden">>, type: BlockType): BlockPlacement {
  const matching = blocks.filter((block) => block.block_type === type);
  if (matching.some((block) => !block.hidden)) return "placed";
  return matching.length ? "hidden" : "available";
}

export const PLACEMENT_LABELS: Record<BlockPlacement, string> = {
  placed: "In your workspace",
  hidden: "Hidden in your workspace. Confirming shows it again.",
  available: "Not in your workspace yet. Confirming adds it.",
};

export function capabilityText(): string {
  return BLOCK_ORDER.map((type) => {
    const capability = BLOCK_CAPABILITIES[type];
    return `- ${type} ("${BLOCK_DEFINITIONS[type].label}"): ${capability.purpose} Can: ${capability.actions.join("; ")}. Fits when: ${capability.appropriateWhen.join("; ")}. Limits: ${capability.limits.join("; ")}.`;
  }).join("\n");
}
