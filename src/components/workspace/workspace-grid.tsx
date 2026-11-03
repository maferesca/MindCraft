"use client";

import ReactGridLayout, { verticalCompactor, type Layout, type LayoutItem } from "react-grid-layout";
import { GRID_COLUMNS, ROW_HEIGHT, positionsForBreakpoint, sizeFor, sortForPhone } from "@/lib/blocks";
import type { BlockType, Breakpoint, WorkspaceBlock } from "@/lib/types";
import { BlockContent } from "./block-content";
import { BlockFrame, type CreativeActions } from "./block-frame";

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

export function WorkspaceGrid({ blocks, width, breakpoint, creative, draggingType, actionsFor, onLayoutCommit, onDropBlock }: WorkspaceGridProps) {
  const visible = blocks.filter((block) => !block.hidden);

  // Phones: one column in the saved phone order (or the desktop reading order).
  if (breakpoint === "sm") {
    const ordered = sortForPhone(visible);
    return (
      <ol className="flex flex-col gap-4" aria-label="Workspace blocks">
        {ordered.map((block, index) => (
          <li key={block.id} style={{ minHeight: Math.min(560, Math.max(300, (block.layouts.lg?.h ?? 6) * 52)) }} className="flex">
            <div className="flex w-full">
              <BlockFrame block={block} breakpoint="sm" creative={actionsFor(block, index, ordered.length)}>
                <BlockContent block={block} />
              </BlockFrame>
            </div>
          </li>
        ))}
      </ol>
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
        dropConfig={{ enabled: creative, defaultItem: { w: dropSize.w, h: dropSize.h } }}
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
            <BlockFrame block={block} breakpoint={breakpoint} creative={actionsFor(block, index, ordered.length)}>
              <BlockContent block={block} />
            </BlockFrame>
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}
