// Pure functions for Creative Mode edits. Each returns a new block array,
// which makes Undo/Redo a simple history of arrays.

import { BLOCK_DEFINITIONS, GRID_COLUMNS, findFreePosition, isMinimized, positionsForBreakpoint, sizeFor, sortForPhone } from "./blocks";
import type { BlockType, Breakpoint, GridPosition, WorkspaceBlock } from "./types";

export type SizePreset = "small" | "medium" | "large" | "full";

export const SIZE_PRESETS: Record<Breakpoint, Record<SizePreset, { w: number; h: number }>> = {
  lg: { small: { w: 3, h: 5 }, medium: { w: 4, h: 7 }, large: { w: 6, h: 8 }, full: { w: 12, h: 7 } },
  md: { small: { w: 3, h: 5 }, medium: { w: 3, h: 7 }, large: { w: 6, h: 8 }, full: { w: 6, h: 7 } },
};

export const SIZE_LABELS: Record<SizePreset, string> = { small: "Small", medium: "Medium", large: "Large", full: "Full width" };

// Fills in positions for the breakpoint so every visible block has one.
export function withPositions(blocks: WorkspaceBlock[], breakpoint: Breakpoint): WorkspaceBlock[] {
  const visible = blocks.filter((block) => !block.hidden);
  const positions = positionsForBreakpoint(visible, breakpoint);
  return blocks.map((block) =>
    positions[block.id] && !block.layouts[breakpoint] ? { ...block, layouts: { ...block.layouts, [breakpoint]: positions[block.id] } } : block,
  );
}

export function applyGridLayout(blocks: WorkspaceBlock[], breakpoint: Breakpoint, layout: Array<GridPosition & { i: string }>) {
  const byId = new Map(layout.map((item) => [item.i, item]));
  let changed = false;
  const next = blocks.map((block) => {
    const item = byId.get(block.id);
    if (!item) return block;
    const current = block.layouts[breakpoint];
    if (current && current.x === item.x && current.y === item.y && current.w === item.w && current.h === item.h) return block;
    changed = true;
    return { ...block, layouts: { ...block.layouts, [breakpoint]: { x: item.x, y: item.y, w: item.w, h: item.h } } };
  });
  return changed ? next : blocks;
}

export function addBlockToDraft(
  blocks: WorkspaceBlock[],
  type: BlockType,
  base: Pick<WorkspaceBlock, "user_id" | "workspace_id">,
  breakpoint: Breakpoint,
  at?: { x: number; y: number },
): WorkspaceBlock {
  const occupied = blocks.filter((block) => !block.hidden && block.layouts.lg).map((block) => block.layouts.lg!);
  const lgSize = sizeFor(type, "lg");
  let lg = findFreePosition(occupied, lgSize.w, lgSize.h, GRID_COLUMNS.lg);
  const layouts: WorkspaceBlock["layouts"] = {};
  if (breakpoint === "lg" && at) lg = { x: Math.min(at.x, GRID_COLUMNS.lg - lgSize.w), y: at.y, w: lgSize.w, h: lgSize.h };
  layouts.lg = lg;
  if (breakpoint === "md") {
    const mdOccupied = blocks.filter((block) => !block.hidden && block.layouts.md).map((block) => block.layouts.md!);
    const mdSize = sizeFor(type, "md");
    layouts.md = at ? { x: Math.min(at.x, GRID_COLUMNS.md - mdSize.w), y: at.y, ...mdSize } : findFreePosition(mdOccupied, mdSize.w, mdSize.h, GRID_COLUMNS.md);
  }
  const now = new Date().toISOString();
  const maxOrder = blocks.reduce((max, block) => Math.max(max, block.mobile_order), 0);
  return {
    id: `new-${crypto.randomUUID()}`,
    ...base,
    block_type: type,
    title: null,
    config: {},
    layouts,
    mobile_order: maxOrder > 0 ? maxOrder + 1 : 0,
    hidden: false,
    created_at: now,
    updated_at: now,
  };
}

function readingOrder(blocks: WorkspaceBlock[], breakpoint: Breakpoint | "sm") {
  // A minimized block is not in the grid, so moving must not swap places with it.
  const visible = blocks.filter((block) => !block.hidden && !isMinimized(block));
  if (breakpoint === "sm") return sortForPhone(visible);
  return [...visible].sort((a, b) => {
    const pa = a.layouts[breakpoint]!;
    const pb = b.layouts[breakpoint]!;
    return pa.y - pb.y || pa.x - pb.x;
  });
}

// Move earlier/later without dragging: swaps places with the neighbour in reading order.
export function moveInOrder(blocks: WorkspaceBlock[], id: string, direction: -1 | 1, breakpoint: Breakpoint | "sm"): WorkspaceBlock[] {
  const ordered = readingOrder(breakpoint === "sm" ? blocks : withPositions(blocks, breakpoint), breakpoint);
  const index = ordered.findIndex((block) => block.id === id);
  const neighbour = ordered[index + direction];
  if (index < 0 || !neighbour) return blocks;

  if (breakpoint === "sm") {
    const reordered = [...ordered];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    const orderById = new Map(reordered.map((block, position) => [block.id, position + 1]));
    return blocks.map((block) => (orderById.has(block.id) ? { ...block, mobile_order: orderById.get(block.id)! } : block));
  }

  const self = ordered[index];
  const a = self.layouts[breakpoint]!;
  const b = neighbour.layouts[breakpoint]!;
  return blocks.map((block) => {
    if (block.id === self.id) return { ...block, layouts: { ...block.layouts, [breakpoint]: { ...a, x: Math.min(b.x, GRID_COLUMNS[breakpoint] - a.w), y: b.y } } };
    if (block.id === neighbour.id) return { ...block, layouts: { ...block.layouts, [breakpoint]: { ...b, x: Math.min(a.x, GRID_COLUMNS[breakpoint] - b.w), y: a.y } } };
    return block;
  });
}

export function resizeBlock(blocks: WorkspaceBlock[], id: string, preset: SizePreset, breakpoint: Breakpoint): WorkspaceBlock[] {
  const prepared = withPositions(blocks, breakpoint);
  return prepared.map((block) => {
    if (block.id !== id) return block;
    const minimum = BLOCK_DEFINITIONS[block.block_type].minSize;
    const size = SIZE_PRESETS[breakpoint][preset];
    const cols = GRID_COLUMNS[breakpoint];
    const w = Math.min(cols, Math.max(size.w, breakpoint === "lg" ? minimum.w : 2));
    const h = Math.max(size.h, minimum.h);
    const current = block.layouts[breakpoint]!;
    return { ...block, layouts: { ...block.layouts, [breakpoint]: { ...current, w, h, x: Math.min(current.x, cols - w) } } };
  });
}

export function nudgeBlock(blocks: WorkspaceBlock[], id: string, dx: number, dy: number, breakpoint: Breakpoint): WorkspaceBlock[] {
  const prepared = withPositions(blocks, breakpoint);
  return prepared.map((block) => {
    if (block.id !== id) return block;
    const current = block.layouts[breakpoint]!;
    const cols = GRID_COLUMNS[breakpoint];
    return {
      ...block,
      layouts: {
        ...block.layouts,
        [breakpoint]: { ...current, x: Math.max(0, Math.min(cols - current.w, current.x + dx)), y: Math.max(0, current.y + dy) },
      },
    };
  });
}

export function currentSizePreset(position: GridPosition | undefined, breakpoint: Breakpoint): SizePreset | "" {
  if (!position) return "";
  const match = (Object.entries(SIZE_PRESETS[breakpoint]) as Array<[SizePreset, { w: number; h: number }]>).find(
    ([, size]) => size.w === position.w && size.h === position.h,
  );
  return match ? match[0] : "";
}
