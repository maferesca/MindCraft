import type { BlockType, Breakpoint, GridPosition, WorkspaceBlock } from "./types";

export interface BlockDefinition {
  type: BlockType;
  label: string;
  description: string;
  defaultSize: { w: number; h: number };
  minSize: { w: number; h: number };
}

// The only block types the app (and AI proposals) may create.
export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  task_list: {
    type: "task_list",
    label: "Tasks",
    description: "Capture tasks, track status, and get help starting.",
    defaultSize: { w: 4, h: 7 },
    minSize: { w: 3, h: 4 },
  },
  calendar: {
    type: "calendar",
    label: "Calendar",
    description: "Your Mindcraft calendar: events, work sessions, and deadlines.",
    defaultSize: { w: 5, h: 7 },
    minSize: { w: 4, h: 5 },
  },
  next_step: {
    type: "next_step",
    label: "Next step",
    description: "One task and the one action you are working on now.",
    defaultSize: { w: 3, h: 5 },
    minSize: { w: 3, h: 4 },
  },
  focus_timer: {
    type: "focus_timer",
    label: "Timer",
    description: "Optional focus sessions with breaks. Never starts on its own.",
    defaultSize: { w: 3, h: 5 },
    minSize: { w: 2, h: 4 },
  },
  notes: {
    type: "notes",
    label: "Notes",
    description: "Simple notes you can link to a task.",
    defaultSize: { w: 4, h: 6 },
    minSize: { w: 3, h: 4 },
  },
};

export const BLOCK_ORDER: BlockType[] = ["task_list", "next_step", "calendar", "focus_timer", "notes"];

export const GRID_COLUMNS: Record<Breakpoint, number> = { lg: 12, md: 6 };
export const ROW_HEIGHT = 48;

// Desktop is "lg", tablet is "md", phones use a one-column list.
export function breakpointForWidth(width: number): Breakpoint | "sm" {
  if (width >= 1024) return "lg";
  if (width >= 640) return "md";
  return "sm";
}

export function sizeFor(type: BlockType, breakpoint: Breakpoint) {
  const definition = BLOCK_DEFINITIONS[type];
  if (breakpoint === "lg") {
    return { ...definition.defaultSize, minW: definition.minSize.w, minH: definition.minSize.h };
  }
  // Tablet grid has 6 columns: wide blocks span the row, narrow ones take half.
  return {
    w: definition.defaultSize.w >= 4 ? 6 : 3,
    h: definition.defaultSize.h,
    minW: 2,
    minH: definition.minSize.h,
  };
}

function overlaps(a: GridPosition, b: GridPosition) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Finds the first free spot scanning row by row, so a new block never covers another.
export function findFreePosition(occupied: GridPosition[], w: number, h: number, cols: number): GridPosition {
  for (let y = 0; y < 200; y += 1) {
    for (let x = 0; x + w <= cols; x += 1) {
      const candidate = { x, y, w, h };
      if (!occupied.some((item) => overlaps(item, candidate))) return candidate;
    }
  }
  const bottom = occupied.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  return { x: 0, y: bottom, w, h };
}

// When a breakpoint has no saved position, derive one from the desktop order
// so tablet and phone keep the same reading order as the desktop arrangement.
export function positionsForBreakpoint(blocks: WorkspaceBlock[], breakpoint: Breakpoint): Record<string, GridPosition> {
  const result: Record<string, GridPosition> = {};
  const cols = GRID_COLUMNS[breakpoint];
  const placed: GridPosition[] = [];
  const withSaved = blocks.filter((block) => block.layouts[breakpoint]);
  for (const block of withSaved) {
    const saved = block.layouts[breakpoint]!;
    const position = { ...saved, w: Math.min(saved.w, cols), x: Math.min(saved.x, Math.max(0, cols - Math.min(saved.w, cols))) };
    result[block.id] = position;
    placed.push(position);
  }
  for (const block of sortByDesktopOrder(blocks.filter((b) => !b.layouts[breakpoint]))) {
    const size = sizeFor(block.block_type, breakpoint);
    const position = findFreePosition(placed, size.w, block.layouts.lg?.h ?? size.h, cols);
    result[block.id] = position;
    placed.push(position);
  }
  return result;
}

export function sortByDesktopOrder(blocks: WorkspaceBlock[]): WorkspaceBlock[] {
  return [...blocks].sort((a, b) => {
    const pa = a.layouts.lg ?? { x: 0, y: 9999 };
    const pb = b.layouts.lg ?? { x: 0, y: 9999 };
    return pa.y - pb.y || pa.x - pb.x || a.created_at.localeCompare(b.created_at);
  });
}

// Phone order: explicit mobile_order when the user reordered on a phone,
// otherwise the desktop reading order (top-to-bottom, left-to-right).
export function sortForPhone(blocks: WorkspaceBlock[]): WorkspaceBlock[] {
  const desktopOrder = sortByDesktopOrder(blocks);
  const hasCustomOrder = blocks.some((block) => block.mobile_order > 0);
  if (!hasCustomOrder) return desktopOrder;
  return [...blocks].sort(
    (a, b) => a.mobile_order - b.mobile_order || desktopOrder.indexOf(a) - desktopOrder.indexOf(b),
  );
}
