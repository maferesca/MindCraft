import type { BlockType } from "./types";

// What the inventory shows. `blockType: null` marks a block that does not exist
// yet: it appears for planning purposes but cannot be added. `options` lists only
// what works today; anything still to build goes in `planned`.
export interface CatalogItem {
  id: string;
  name: string;
  blockType: BlockType | null;
  description: string;
  options: string[];
  planned: string[];
}

export interface CatalogCategory {
  id: string;
  label: string;
  items: CatalogItem[];
}

export const BLOCK_CATALOG: CatalogCategory[] = [
  {
    id: "planning",
    label: "Planning",
    items: [
      {
        id: "tasks",
        name: "Tasks",
        blockType: "task_list",
        description: "View and organize tasks, and set priorities.",
        options: ["Compact or expanded list", "Filter by status or date"],
        planned: ["Board view"],
      },
      {
        id: "calendar",
        name: "Calendar",
        blockType: "calendar",
        description: "View deadlines, events, and scheduled work.",
        options: ["Month grid", "Day or week agenda in rows"],
        planned: [],
      },
    ],
  },
  {
    id: "focus",
    label: "Focus",
    items: [
      {
        id: "task-guide",
        name: "Task guide",
        blockType: "next_step",
        description: "Work through a task one step at a time.",
        options: ["One step at a time", "Edit, shrink, or add steps"],
        planned: ["Goal, deliverable, and instructions", "Full checklist", "Final review checklist"],
      },
      {
        id: "focus-timer",
        name: "Focus timer",
        blockType: "focus_timer",
        description: "Run an adjustable countdown with optional breaks.",
        options: ["Pomodoro or custom length", "Optional break", "Optional sound"],
        planned: ["Stopwatch"],
      },
    ],
  },
  {
    id: "support",
    label: "Support",
    items: [
      {
        id: "notes",
        name: "Notes",
        blockType: "notes",
        description: "Capture ideas and meeting notes.",
        options: ["Quick capture", "Link a note to a task"],
        planned: ["Personal checklists"],
      },
      {
        id: "resources",
        name: "Resources",
        blockType: null,
        description: "Keep useful links and supported files together, connected to tasks or projects.",
        options: [],
        planned: [],
      },
      {
        id: "check-in",
        name: "Check-in",
        blockType: null,
        description: "Share progress, explain blockers, or request support through short updates.",
        options: [],
        planned: [],
      },
    ],
  },
];

export const CATALOG_ITEMS = BLOCK_CATALOG.flatMap((category) => category.items);
