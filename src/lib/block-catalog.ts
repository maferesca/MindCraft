import type { BlockType } from "./types";

// What the inventory shows. `options` lists only what works today; anything
// still to build goes in `planned`.
export interface CatalogItem {
  id: string;
  name: string;
  blockType: BlockType;
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
        options: ["List or board", "Filter by date or completion", "Sort by deadline, priority, or title"],
        planned: [],
      },
      {
        id: "calendar",
        name: "Calendar",
        blockType: "calendar",
        description: "View deadlines, events, and scheduled work.",
        options: ["Month, week, or day", "Agenda in rows", "Filter by project or type"],
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
        description: "See a task's instructions, deliverable, steps, and review checklist.",
        options: ["One step or all steps", "Before submitting checklist", "Linked resources"],
        planned: [],
      },
      {
        id: "focus-timer",
        name: "Focus timer",
        blockType: "focus_timer",
        description: "Use an adjustable countdown or stopwatch, with optional breaks and sound.",
        options: ["Countdown or stopwatch", "Editable break", "Optional sound"],
        planned: [],
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
        description: "Capture ideas, meeting notes, and personal checklists.",
        options: ["Bullets and checklists", "Pin notes", "Link to a task or project"],
        planned: [],
      },
      {
        id: "resources",
        name: "Resources",
        blockType: "resources",
        description: "Keep useful links together, connected to tasks or projects.",
        options: ["List or cards", "Favorites", "Filter by project or task"],
        planned: ["File uploads"],
      },
      {
        id: "check-in",
        name: "Check-in",
        blockType: "check_in",
        description: "Write progress updates and help requests as private drafts.",
        options: ["Progress update", "I need help", "Open, Waiting, or Resolved"],
        planned: ["Sharing with others"],
      },
    ],
  },
];

export const CATALOG_ITEMS = BLOCK_CATALOG.flatMap((category) => category.items);
