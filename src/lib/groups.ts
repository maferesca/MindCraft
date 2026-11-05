// Work groups: pure functions over the block array, like the other Creative Mode
// edits, so Undo, Redo, Cancel, and Save work without extra code. A group is the
// set of blocks that carry the same group_id. Nothing here touches block content.

import { GRID_COLUMNS, isMinimized } from "./blocks";
import { withPositions } from "./layout-edit";
import type { Breakpoint, GridPosition, WorkspaceBlock } from "./types";

export const DEFAULT_GROUP_TITLE = "New group";

export interface WorkGroup {
  id: string;
  title: string;
  members: WorkspaceBlock[];
}

export function workGroups(blocks: WorkspaceBlock[]): WorkGroup[] {
  const groups = new Map<string, WorkGroup>();
  for (const block of blocks) {
    if (!block.group_id) continue;
    const group = groups.get(block.group_id);
    if (group) group.members.push(block);
    else groups.set(block.group_id, { id: block.group_id, title: block.group_title || DEFAULT_GROUP_TITLE, members: [block] });
  }
  return [...groups.values()];
}

function overlaps(a: GridPosition, b: GridPosition) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

const inGrid = (block: WorkspaceBlock) => !block.hidden && !isMinimized(block);

// Blocks that the moved blocks now cover go underneath them. The grid then closes
// any gaps, while the moved blocks keep their arrangement.
function clearSpace(blocks: WorkspaceBlock[], movedIds: Set<string>, breakpoint: Breakpoint) {
  const moved = blocks.filter((block) => movedIds.has(block.id) && inGrid(block)).map((block) => block.layouts[breakpoint]!);
  const bottom = Math.max(...moved.map((position) => position.y + position.h));
  return blocks.map((block) => {
    const position = block.layouts[breakpoint];
    if (movedIds.has(block.id) || !position || !inGrid(block) || !moved.some((item) => overlaps(item, position))) return block;
    return { ...block, layouts: { ...block.layouts, [breakpoint]: { ...position, y: bottom } } };
  });
}

// Beside the block it joined when that space is free, otherwise under the group.
function placeInGroup(blocks: WorkspaceBlock[], id: string, targetId: string, groupId: string, breakpoint: Breakpoint) {
  const self = blocks.find((block) => block.id === id)!;
  const target = blocks.find((block) => block.id === targetId)!;
  const own = self.layouts[breakpoint]!;
  const anchor = target.layouts[breakpoint]!;
  const beside = { ...own, x: anchor.x + anchor.w, y: anchor.y };
  const others = blocks.filter((block) => block.id !== id && inGrid(block) && block.layouts[breakpoint]);
  const free = beside.x + beside.w <= GRID_COLUMNS[breakpoint] && !others.some((block) => overlaps(block.layouts[breakpoint]!, beside));
  const members = others.filter((block) => block.group_id === groupId).map((block) => block.layouts[breakpoint]!);
  const left = Math.min(...members.map((position) => position.x));
  const below = { ...own, x: Math.min(left, GRID_COLUMNS[breakpoint] - own.w), y: Math.max(...members.map((position) => position.y + position.h)) };
  const placed = blocks.map((block) => (block.id === id ? { ...block, layouts: { ...block.layouts, [breakpoint]: free ? beside : below } } : block));
  return clearSpace(placed, new Set([id]), breakpoint);
}

// Joins the target's group, or starts a new group with the target.
export function joinGroup(blocks: WorkspaceBlock[], id: string, targetId: string, breakpoint: Breakpoint | "sm"): WorkspaceBlock[] {
  const prepared = breakpoint === "sm" ? blocks : withPositions(blocks, breakpoint);
  const target = prepared.find((block) => block.id === targetId);
  if (!target || id === targetId) return blocks;
  const groupId = target.group_id ?? crypto.randomUUID();
  const title = target.group_title || DEFAULT_GROUP_TITLE;
  const joined = prepared.map((block) => (block.id === id || block.id === targetId ? { ...block, group_id: groupId, group_title: title } : block));
  return breakpoint === "sm" ? joined : placeInGroup(joined, id, targetId, groupId, breakpoint);
}

export function leaveGroup(blocks: WorkspaceBlock[], id: string): WorkspaceBlock[] {
  return blocks.map((block) => (block.id === id ? { ...block, group_id: null, group_title: null } : block));
}

export function renameGroup(blocks: WorkspaceBlock[], groupId: string, title: string): WorkspaceBlock[] {
  const clean = title.trim().slice(0, 60);
  if (!clean) return blocks;
  return blocks.map((block) => (block.group_id === groupId ? { ...block, group_title: clean } : block));
}

// The blocks stay exactly where they are, without the shared group.
export function removeGroup(blocks: WorkspaceBlock[], groupId: string): WorkspaceBlock[] {
  return blocks.map((block) => (block.group_id === groupId ? { ...block, group_id: null, group_title: null } : block));
}

// Every member moves by the same amount, so the arrangement inside is preserved.
export function moveGroup(blocks: WorkspaceBlock[], groupId: string, dx: number, dy: number, breakpoint: Breakpoint): WorkspaceBlock[] {
  const prepared = withPositions(blocks, breakpoint);
  const members = prepared.filter((block) => block.group_id === groupId && block.layouts[breakpoint]);
  if (!members.length) return blocks;
  const positions = members.map((block) => block.layouts[breakpoint]!);
  const left = Math.min(...positions.map((position) => position.x));
  const right = Math.max(...positions.map((position) => position.x + position.w));
  const top = Math.min(...positions.map((position) => position.y));
  const shiftX = Math.max(-left, Math.min(GRID_COLUMNS[breakpoint] - right, dx));
  const shiftY = Math.max(-top, dy);
  const moved = prepared.map((block) => {
    const position = block.layouts[breakpoint];
    if (block.group_id !== groupId || !position) return block;
    return { ...block, layouts: { ...block.layouts, [breakpoint]: { ...position, x: position.x + shiftX, y: position.y + shiftY } } };
  });
  return clearSpace(moved, new Set(members.map((block) => block.id)), breakpoint);
}

// On a phone the list keeps each group's blocks together, at its first member's place.
export function keepGroupsTogether(ordered: WorkspaceBlock[]): WorkspaceBlock[] {
  const seen = new Set<string>();
  return ordered.flatMap((block) => {
    if (!block.group_id) return [block];
    if (seen.has(block.group_id)) return [];
    seen.add(block.group_id);
    return ordered.filter((item) => item.group_id === block.group_id);
  });
}
