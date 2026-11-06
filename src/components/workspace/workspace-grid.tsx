"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import ReactGridLayout, { cloneLayout, getLayoutItem, moveElement, verticalCompactor, type Layout, type LayoutItem } from "react-grid-layout";
import { noOverlapCompactor } from "react-grid-layout/core";
import { Plus } from "lucide-react";
import { BLOCK_DEFINITIONS, GRID_COLUMNS, ROW_HEIGHT, isGroupMinimized, isMinimized, positionsForBreakpoint, sizeFor, sortForPhone } from "@/lib/blocks";
import { keepGroupsTogether, workGroups, type WorkGroup } from "@/lib/groups";
import type { BlockType, Breakpoint, WorkspaceBlock } from "@/lib/types";
import { BlockIcon } from "../blocks/block-icon";
import { useWorkspaceData } from "../providers/workspace-data";
import { IconButton } from "../ui/icon-button";
import { BlockContent } from "./block-content";
import { BlockFrame, focusAfterRender, type CreativeActions } from "./block-frame";
import { GroupHeader, type GroupActions } from "./group-header";

const MARGIN = 16;
// A group's title bar is a one-row grid item, which is what lets it be dragged.
const HEADER_PREFIX = "group:";

interface WorkspaceGridProps {
  blocks: WorkspaceBlock[];
  width: number;
  breakpoint: Breakpoint | "sm";
  creative: boolean;
  draggingType: BlockType | null;
  actionsFor: (block: WorkspaceBlock, index: number, total: number) => CreativeActions | null;
  groupActions: GroupActions | null;
  onLayoutCommit: (layout: Layout) => void;
  onSnapToGroup: (id: string, targetBlockId: string) => void;
  onMoveGroup: (groupId: string, dx: number, dy: number) => void;
  onDropBlock: (x: number, y: number) => void;
}

interface SnapTarget {
  blockId: string;
  label: string;
  item: LayoutItem;
}

// Minimized blocks and groups wait here and take no space in the grid. A group
// shows its name, because several icons alone would not say which group it is.
function MinimizedTray({ blocks, groups }: { blocks: WorkspaceBlock[]; groups: WorkGroup[] }) {
  const { updateBlockConfig } = useWorkspaceData();
  if (!blocks.length && !groups.length) return null;
  return (
    <ul aria-label="Minimized blocks and groups" className="mb-4 flex flex-wrap gap-2">
      {groups.map((group) => (
        <li key={group.id} className="mc-card flex items-center gap-2 bg-primary-soft py-0.5 pl-3 pr-0.5">
          {group.members.slice(0, 4).map((block) => (
            <BlockIcon key={block.id} type={block.block_type} size={18} />
          ))}
          <span className="max-w-48 truncate font-semibold">{group.title}</span>
          <IconButton
            size="sm"
            label={`Restore group ${group.title}`}
            icon={<Plus size={18} />}
            data-restore-group={group.id}
            onClick={() => {
              for (const block of group.members) updateBlockConfig(block.id, { groupMinimized: false });
              focusAfterRender(`[data-minimize-group="${group.id}"]`);
            }}
          />
        </li>
      ))}
      {blocks.map((block) => {
        const title = block.title || BLOCK_DEFINITIONS[block.block_type].label;
        return (
          <li key={block.id} className="mc-card flex items-center gap-1 py-0.5 pl-2.5 pr-0.5">
            <BlockIcon type={block.block_type} size={18} />
            <IconButton
              size="sm"
              label={`Restore ${title}`}
              icon={<Plus size={18} />}
              data-restore-block={block.id}
              onClick={() => {
                updateBlockConfig(block.id, { minimized: false });
                focusAfterRender(`[data-minimize-block="${block.id}"]`);
              }}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function WorkspaceGrid({ blocks, width, breakpoint, creative, draggingType, actionsFor, groupActions, onLayoutCommit, onSnapToGroup, onMoveGroup, onDropBlock }: WorkspaceGridProps) {
  const shown = blocks.filter((block) => !block.hidden);
  // Every block of a minimized group leaves the grid, even one added afterwards.
  const minimizedGroupIds = new Set(shown.filter(isGroupMinimized).map((block) => block.group_id));
  const inMinimizedGroup = (block: WorkspaceBlock) => minimizedGroupIds.has(block.group_id);
  const minimizedGroups = workGroups(shown.filter(inMinimizedGroup));
  const minimized = shown.filter((block) => isMinimized(block) && !inMinimizedGroup(block));
  const visible = shown.filter((block) => !isMinimized(block) && !inMinimizedGroup(block));
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const lastMaximized = useRef<string | null>(null);
  const maximized = creative ? null : (visible.find((block) => block.id === maximizedId) ?? null);
  const activeId = maximized?.id ?? null;

  // Blocks stay still while one is dragged, so a snap target never moves away from
  // the pointer. Where the block lands is worked out when it is dropped.
  const [dragging, setDragging] = useState(false);
  const [snap, setSnap] = useState<SnapTarget | null>(null);
  const snapRef = useRef<SnapTarget | null>(null);
  const layoutBeforeDrag = useRef<Layout>([]);
  const gridRef = useRef<HTMLDivElement>(null);

  // Escape belongs to any dialog or panel that is open first.
  useEffect(() => {
    if (!activeId) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key !== "Escape" || document.querySelector("[role='dialog']") || target.closest("#assistant-panel, [data-local-escape]")) return;
      setMaximizedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId]);

  // The button that opened full size comes back with the grid, so focus returns to it.
  useEffect(() => {
    if (activeId) lastMaximized.current = activeId;
    else if (lastMaximized.current) {
      document.querySelector<HTMLElement>(`[data-maximize-block="${lastMaximized.current}"]`)?.focus();
      lastMaximized.current = null;
    }
  }, [activeId]);

  const toggleMaximize = creative ? undefined : (id: string) => setMaximizedId((current) => (current === id ? null : id));

  // Temporary and never saved: the arrangement returns exactly as it was.
  if (maximized) {
    return (
      <div className="flex min-h-96" style={{ height: "calc(100dvh - var(--header-height) - 7rem)" }}>
        <div className="flex w-full">
          <BlockFrame block={maximized} breakpoint={breakpoint} creative={null} maximized onToggleMaximize={() => setMaximizedId(null)}>
            <BlockContent block={maximized} />
          </BlockFrame>
        </div>
      </div>
    );
  }

  const groups = workGroups(visible);

  // Phones: one column in the saved phone order, with each group's blocks together.
  if (breakpoint === "sm") {
    const ordered = keepGroupsTogether(sortForPhone(visible));
    return (
      <>
      <MinimizedTray blocks={minimized} groups={minimizedGroups} />
      <ol className="flex flex-col gap-4" aria-label="Workspace blocks">
        {ordered.map((block, index) => {
          const group = block.group_id && ordered[index - 1]?.group_id !== block.group_id ? groups.find((item) => item.id === block.group_id) : null;
          return (
            <Fragment key={block.id}>
              {group ? (
                <li className="rounded-xl bg-primary-soft p-1">
                  <GroupHeader group={group} actions={groupActions} draggable={false} />
                </li>
              ) : null}
              <li className={`flex ${block.group_id ? "border-l-4 border-primary-soft pl-2" : ""}`}>
                <div className="flex w-full">
                  <BlockFrame block={block} breakpoint="sm" creative={actionsFor(block, index, ordered.length)} onToggleMaximize={toggleMaximize && (() => toggleMaximize(block.id))}>
                    <BlockContent block={block} />
                  </BlockFrame>
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>
      </>
    );
  }

  const cols = GRID_COLUMNS[breakpoint];
  const positions = positionsForBreakpoint(visible, breakpoint);

  // Headers come first, so at the same height a header stays above its blocks.
  const headers: Layout = groups.map((group) => {
    const members = group.members.map((block) => positions[block.id]);
    const left = Math.min(...members.map((item) => item.x));
    const right = Math.max(...members.map((item) => item.x + item.w));
    const top = Math.min(...members.map((item) => item.y));
    return { i: `${HEADER_PREFIX}${group.id}`, x: left, y: Math.max(0, top - 1), w: Math.max(right - left, 2), h: 1, minH: 1, maxH: 1, isResizable: false };
  });
  const blockItems: Layout = visible.map((block) => {
    const minimum = sizeFor(block.block_type, breakpoint);
    return { i: block.id, ...positions[block.id], minW: minimum.minW, minH: minimum.minH };
  });
  const layout = verticalCompactor.compact([...headers, ...blockItems], cols);
  const itemFor = (id: string) => layout.find((item) => item.i === id)!;

  const ordered = [...visible].sort((a, b) => itemFor(a.id).y - itemFor(b.id).y || itemFor(a.id).x - itemFor(b.id).x);
  const dropSize = draggingType ? sizeFor(draggingType, breakpoint) : { w: 4, h: 6 };
  const droppingItem: LayoutItem = { i: "__dropping__", x: 0, y: 0, w: dropSize.w, h: dropSize.h };

  const columnWidth = (width - MARGIN * (cols - 1)) / cols;
  const pixels = (item: Pick<LayoutItem, "x" | "y" | "w" | "h">) => ({
    left: item.x * (columnWidth + MARGIN),
    top: item.y * (ROW_HEIGHT + MARGIN),
    width: item.w * columnWidth + (item.w - 1) * MARGIN,
    height: item.h * ROW_HEIGHT + (item.h - 1) * MARGIN,
  });

  // A snap target is another block's header row, or a group's title bar. The rest of
  // a block stays a normal place to drop, so nearby blocks are never grouped by accident.
  function findSnapTarget(draggedId: string, event: Event): SnapTarget | null {
    const grid = gridRef.current?.getBoundingClientRect();
    const point = "clientX" in event ? (event as MouseEvent) : (event as TouchEvent).changedTouches?.[0];
    if (!grid || !point) return null;
    const x = point.clientX - grid.left;
    const y = point.clientY - grid.top;
    const dragged = visible.find((block) => block.id === draggedId);
    for (const item of layout) {
      const area = pixels(item);
      const zoneHeight = Math.min(area.height, ROW_HEIGHT + MARGIN);
      if (item.i === draggedId || x < area.left || x > area.left + area.width || y < area.top || y > area.top + zoneHeight) continue;
      if (item.i.startsWith(HEADER_PREFIX)) {
        const group = groups.find((entry) => `${HEADER_PREFIX}${entry.id}` === item.i)!;
        if (group.id === dragged?.group_id) continue;
        return { blockId: group.members[0].id, label: `Drop to add to ${group.title}`, item };
      }
      const target = visible.find((block) => block.id === item.i)!;
      if (target.group_id && target.group_id === dragged?.group_id) continue;
      return { blockId: target.id, label: target.group_id ? `Drop to add to ${target.group_title}` : `Drop to group with ${target.title || BLOCK_DEFINITIONS[target.block_type].label}`, item };
    }
    return null;
  }

  function updateSnap(next: SnapTarget | null) {
    snapRef.current = next;
    setSnap((current) => (current?.blockId === next?.blockId ? current : next));
  }

  function finishDrag(id: string, oldItem: LayoutItem | null, dropped: Layout) {
    const target = snapRef.current;
    updateSnap(null);
    setDragging(false);
    const final = getLayoutItem(dropped, id);
    if (!final) return;
    if (id.startsWith(HEADER_PREFIX)) {
      if (oldItem) onMoveGroup(id.slice(HEADER_PREFIX.length), final.x - oldItem.x, final.y - oldItem.y);
      return;
    }
    if (target) {
      onSnapToGroup(id, target.blockId);
      return;
    }
    // A normal drop: other blocks make room now, the same way as a live drag would.
    const before = cloneLayout(layoutBeforeDrag.current);
    const item = getLayoutItem(before, id);
    if (!item) return;
    const moved = moveElement(before, item, final.x, final.y, true, false, "vertical", cols, false);
    onLayoutCommit(verticalCompactor.compact(moved, cols).filter((entry) => !entry.i.startsWith(HEADER_PREFIX)));
  }

  return (
    <>
    <MinimizedTray blocks={minimized} groups={minimizedGroups} />
    <div
      ref={gridRef}
      className={`relative ${creative ? "mc-grid-guides min-h-[60vh]" : ""}`}
      style={
        {
          "--grid-col-width": `${(width + MARGIN) / cols}px`,
          "--grid-row-height": `${ROW_HEIGHT + MARGIN}px`,
        } as React.CSSProperties
      }
    >
      {/* A soft area behind each group. Drawn per block, so it never covers a block outside the group. */}
      {groups.map((group) => (
        <div key={group.id} aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-50">
          {[`${HEADER_PREFIX}${group.id}`, ...group.members.map((block) => block.id)].map((id) => {
            const area = pixels(itemFor(id));
            return (
              <span
                key={id}
                className="absolute rounded-2xl bg-primary-soft"
                style={{ left: area.left - MARGIN / 2, top: area.top - MARGIN / 2, width: area.width + MARGIN, height: area.height + MARGIN }}
              />
            );
          })}
        </div>
      ))}
      <ReactGridLayout
        width={width}
        layout={layout}
        gridConfig={{ cols, rowHeight: ROW_HEIGHT, margin: [MARGIN, MARGIN], containerPadding: [0, 0] }}
        dragConfig={{ enabled: creative, handle: ".mc-drag-handle", cancel: "input, textarea, select, button, a, [role='menuitem']" }}
        resizeConfig={{ enabled: creative, handles: ["se"] }}
        // Only blocks from the toolbar drop here; board cards keep their own drag and drop.
        dropConfig={{ enabled: creative && draggingType !== null, defaultItem: { w: dropSize.w, h: dropSize.h } }}
        droppingItem={droppingItem}
        compactor={dragging ? noOverlapCompactor : verticalCompactor}
        onDragStart={(current) => {
          layoutBeforeDrag.current = cloneLayout(current);
          setDragging(true);
        }}
        onDrag={(_layout, _old, item, _placeholder, event) => {
          if (item && !item.i.startsWith(HEADER_PREFIX)) updateSnap(findSnapTarget(item.i, event));
        }}
        onDragStop={(dropped, oldItem, item) => {
          if (item) finishDrag(item.i, oldItem, dropped);
        }}
        onResizeStop={(next) => onLayoutCommit(next.filter((entry) => !entry.i.startsWith(HEADER_PREFIX)))}
        onDrop={(_layout, item) => {
          if (item) onDropBlock(item.x, item.y);
        }}
        className={creative ? "min-h-[60vh]" : ""}
      >
        {groups.map((group) => (
          <div key={`${HEADER_PREFIX}${group.id}`}>
            <GroupHeader group={group} actions={groupActions} draggable />
          </div>
        ))}
        {ordered.map((block, index) => (
          <div key={block.id}>
            <BlockFrame block={block} breakpoint={breakpoint} creative={actionsFor(block, index, ordered.length)} onToggleMaximize={toggleMaximize && (() => toggleMaximize(block.id))}>
              <BlockContent block={block} />
            </BlockFrame>
          </div>
        ))}
      </ReactGridLayout>
      {snap ? (
        <div className="pointer-events-none absolute z-30 flex items-start justify-center rounded-2xl border-4 border-dashed border-primary bg-primary-soft/70 pt-2" style={pixels(snap.item)}>
          <span role="status" className="rounded-full bg-primary px-3 py-1 text-sm font-bold text-on-primary">
            {snap.label}
          </span>
        </div>
      ) : null}
    </div>
    </>
  );
}
