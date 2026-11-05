import type { BlockType } from "./types";

// What the inventory shows. `options` lists only what works today; anything
// still to build goes in `planned`.
export interface CatalogItem {
  id: string;
  name: string;
  blockType: BlockType;
  description: string;
  // One practical use, shown in the block's information popover.
  example: string;
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
        example: "List this week's reports and sort them by deadline.",
        options: ["List or board", "Filter by date or completion", "Sort by deadline, priority, or title"],
        planned: [],
      },
      {
        id: "calendar",
        name: "Calendar",
        blockType: "calendar",
        description: "View deadlines, events, and scheduled work.",
        example: "Reserve Tuesday morning to work on a proposal.",
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
        example: "Follow a report one step at a time, then check it before sending.",
        options: ["Quick Start, Guided, or Detailed", "List or Visual view", "Before submitting checklist", "Missing information", "Linked resources"],
        planned: [],
      },
      {
        id: "focus-timer",
        name: "Focus timer",
        blockType: "focus_timer",
        description: "Use an adjustable countdown or stopwatch, with optional breaks and sound.",
        example: "Set 25 minutes to draft an email, then take a 5-minute break.",
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
        example: "Write down decisions from a meeting and link them to a task.",
        options: ["Bullets and checklists", "Pin notes", "Link to a task or project"],
        planned: [],
      },
      {
        id: "resources",
        name: "Resources",
        blockType: "resources",
        description: "Keep useful links together, connected to tasks or projects.",
        example: "Save the shared brief and a template next to the task that uses them.",
        options: ["List or cards", "Favorites", "Filter by project or task"],
        planned: ["File uploads"],
      },
      {
        id: "check-in",
        name: "Check-in",
        blockType: "check_in",
        description: "Write progress updates and help requests as private drafts.",
        example: "Prepare a note about what you finished and what you need next.",
        options: ["Progress update", "I need help", "Open, Waiting, or Resolved"],
        planned: ["Sharing with others"],
      },
    ],
  },
];

export const CATALOG_ITEMS = BLOCK_CATALOG.flatMap((category) => category.items);

export function catalogItemFor(type: BlockType) {
  return CATALOG_ITEMS.find((item) => item.blockType === type)!;
}
