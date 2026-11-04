"use client";

import { useEffect, useRef, useState } from "react";
import ReactGridLayout, { verticalCompactor, type Layout, type LayoutItem } from "react-grid-layout";
import { Plus } from "lucide-react";
import { BLOCK_DEFINITIONS, GRID_COLUMNS, ROW_HEIGHT, isMinimized, positionsForBreakpoint, sizeFor, sortForPhone } from "@/lib/blocks";
import type { BlockType, Breakpoint, WorkspaceBlock } from "@/lib/types";
import { BlockIcon } from "../blocks/block-icon";
import { useWorkspaceData } from "../providers/workspace-data";
import { IconButton } from "../ui/icon-button";
import { BlockContent } from "./block-content";
import { BlockFrame, focusAfterRender, type CreativeActions } from "./block-frame";

const MARGIN = 16;

interface WorkspaceGridProps {
  blocks: WorkspaceBlock[];
  width: number;
  breakpoint: Breakpoint | "sm";
  creative: boolean;
  draggingType: BlockType | null;
  actionsFor: (block: WorkspaceBlock, index: number, total: number) => CreativeActions | null;
  onLayoutCommit: (layout: Layout) => void;
  onDropBlock: (x: number, y: number) => void;
}

// Minimized blocks wait here as small icons and take no space in the grid.
function MinimizedTray({ blocks }: { blocks: WorkspaceBlock[] }) {
  const { updateBlockConfig } = useWorkspaceData();
  if (!blocks.length) return null;
  return (
    <ul aria-label="Minimized blocks" className="mb-4 flex flex-wrap gap-2">
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

export function WorkspaceGrid({ blocks, width, breakpoint, creative, draggingType, actionsFor, onLayoutCommit, onDropBlock }: WorkspaceGridProps) {
  const shown = blocks.filter((block) => !block.hidden);
  const minimized = shown.filter(isMinimized);
  const visible = shown.filter((block) => !isMinimized(block));
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const lastMaximized = useRef<string | null>(null);
  const maximized = creative ? null : (visible.find((block) => block.id === maximizedId) ?? null);
  const activeId = maximized?.id ?? null;

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

  // Phones: one column in the saved phone order (or the desktop reading order).
  if (breakpoint === "sm") {
    const ordered = sortForPhone(visible);
    return (
      <>
      <MinimizedTray blocks={minimized} />
      <ol className="flex flex-col gap-4" aria-label="Workspace blocks">
        {ordered.map((block, index) => (
          <li key={block.id} style={{ minHeight: Math.min(560, Math.max(300, (block.layouts.lg?.h ?? 6) * 52)) }} className="flex">
            <div className="flex w-full">
              <BlockFrame block={block} breakpoint="sm" creative={actionsFor(block, index, ordered.length)} onToggleMaximize={toggleMaximize && (() => toggleMaximize(block.id))}>
                <BlockContent block={block} />
              </BlockFrame>
            </div>
          </li>
        ))}
      </ol>
      </>
    );
  }

  const cols = GRID_COLUMNS[breakpoint];
  const positions = positionsForBreakpoint(visible, breakpoint);
  const layout: Layout = visible.map((block) => {
    const minimum = sizeFor(block.block_type, breakpoint);
    return { i: block.id, ...positions[block.id], minW: minimum.minW, minH: minimum.minH };
  });
  const ordered = [...visible].sort((a, b) => positions[a.id].y - positions[b.id].y || positions[a.id].x - positions[b.id].x);
  const dropSize = draggingType ? sizeFor(draggingType, breakpoint) : { w: 4, h: 6 };
  const droppingItem: LayoutItem = { i: "__dropping__", x: 0, y: 0, w: dropSize.w, h: dropSize.h };

  return (
    <>
    <MinimizedTray blocks={minimized} />
    <div
      className={creative ? "mc-grid-guides min-h-[60vh]" : ""}
      style={
        {
          "--grid-col-width": `${(width + MARGIN) / cols}px`,
          "--grid-row-height": `${ROW_HEIGHT + MARGIN}px`,
        } as React.CSSProperties
      }
    >
      <ReactGridLayout
        width={width}
        layout={layout}
        gridConfig={{ cols, rowHeight: ROW_HEIGHT, margin: [MARGIN, MARGIN], containerPadding: [0, 0] }}
        dragConfig={{ enabled: creative, handle: ".mc-drag-handle", cancel: "input, textarea, select, button, a, [role='menuitem']" }}
        resizeConfig={{ enabled: creative, handles: ["se"] }}
        // Only blocks from the toolbar drop here; board cards keep their own drag and drop.
        dropConfig={{ enabled: creative && draggingType !== null, defaultItem: { w: dropSize.w, h: dropSize.h } }}
        droppingItem={droppingItem}
        compactor={verticalCompactor}
        onDragStop={(next) => onLayoutCommit(next)}
        onResizeStop={(next) => onLayoutCommit(next)}
        onDrop={(_layout, item) => {
          if (item) onDropBlock(item.x, item.y);
        }}
        className={creative ? "min-h-[60vh]" : ""}
      >
        {ordered.map((block, index) => (
          <div key={block.id}>
            <BlockFrame block={block} breakpoint={breakpoint} creative={actionsFor(block, index, ordered.length)} onToggleMaximize={toggleMaximize && (() => toggleMaximize(block.id))}>
              <BlockContent block={block} />
            </BlockFrame>
          </div>
        ))}
      </ReactGridLayout>
    </div>
    </>
  );
}
