"use client";

import { Redo2, Save, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useContainerWidth, type Layout } from "react-grid-layout";
import { BLOCK_DEFINITIONS, breakpointForWidth } from "@/lib/blocks";
import { addBlockToDraft, applyGridLayout, moveInOrder, nudgeBlock, resizeBlock, withPositions } from "@/lib/layout-edit";
import type { BlockType, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";
import type { CreativeActions } from "./block-frame";
import { EmptyState } from "./empty-state";
import { InventoryDock } from "./inventory-dock";
import { WorkspaceGrid } from "./workspace-grid";

interface History {
  past: WorkspaceBlock[][];
  present: WorkspaceBlock[];
  future: WorkspaceBlock[][];
}

export function WorkspaceView() {
  const { blocks, workspace, saveLayout } = useWorkspaceData();
  const { creativeMode, setCreativeMode } = useWorkspaceUI();
  const { announce, notify } = useNotify();
  const { width, containerRef, mounted } = useContainerWidth();
  const breakpoint = breakpointForWidth(width || 1200);
  const [history, setHistory] = useState<History | null>(null);
  const [draggingType, setDraggingType] = useState<BlockType | null>(null);
  const [pendingRemoval, setPendingRemoval] = useState<WorkspaceBlock | null>(null);
  const [saving, setSaving] = useState(false);
  const startedRef = useRef(false);

  // Starting Creative Mode takes a snapshot; Cancel returns to it.
  // Task, note, and event edits are not part of the snapshot, so Cancel never erases them.
  useEffect(() => {
    if (creativeMode && !startedRef.current) {
      startedRef.current = true;
      setHistory({ past: [], present: blocks, future: [] });
      announce("Creative Mode on. Add, move, and resize blocks, then save.");
    }
    if (!creativeMode && startedRef.current) {
      startedRef.current = false;
      setHistory(null);
    }
  }, [creativeMode, blocks, announce]);

  const commit = useCallback((next: WorkspaceBlock[]) => {
    setHistory((current) => (current && next !== current.present ? { past: [...current.past, current.present], present: next, future: [] } : current));
  }, []);

  const draft = history?.present ?? blocks;
  const shown = creativeMode ? draft : blocks;
  const visibleCount = shown.filter((block) => !block.hidden).length;
  const base = { user_id: workspace?.user_id ?? "", workspace_id: workspace?.id ?? "" };

  function addBlock(type: BlockType, at?: { x: number; y: number }) {
    const gridBreakpoint = breakpoint === "sm" ? "lg" : breakpoint;
    const prepared = breakpoint === "sm" ? draft : withPositions(draft, gridBreakpoint);
    const block = addBlockToDraft(prepared, type, base, gridBreakpoint, at);
    commit([...prepared, block]);
    announce(`${BLOCK_DEFINITIONS[type].label} block added. Save to keep it.`);
  }

  function actionsFor(block: WorkspaceBlock, index: number, total: number): CreativeActions | null {
    if (!creativeMode) return null;
    const label = BLOCK_DEFINITIONS[block.block_type].label;
    const gridBreakpoint = breakpoint === "sm" ? null : breakpoint;
    return {
      isFirst: index === 0,
      isLast: index === total - 1,
      moveEarlier: () => {
        commit(moveInOrder(draft, block.id, -1, breakpoint));
        announce(`${label} moved earlier.`);
      },
      moveLater: () => {
        commit(moveInOrder(draft, block.id, 1, breakpoint));
        announce(`${label} moved later.`);
      },
      resize: (preset) => {
        if (!gridBreakpoint) return;
        commit(resizeBlock(draft, block.id, preset, gridBreakpoint));
        announce(`${label} resized.`);
      },
      nudge: (dx, dy) => {
        if (!gridBreakpoint) return;
        commit(nudgeBlock(draft, block.id, dx, dy, gridBreakpoint));
      },
      hide: () => {
        commit(draft.map((item) => (item.id === block.id ? { ...item, hidden: true } : item)));
        announce(`${label} hidden. You can show it again from the inventory.`);
      },
      remove: () => setPendingRemoval(block),
    };
  }

  async function handleSave() {
    if (!history) return;
    setSaving(true);
    const ok = await saveLayout(history.present);
    setSaving(false);
    if (ok) {
      setCreativeMode(false);
      notify("Layout saved.");
    }
  }

  function handleCancel() {
    setCreativeMode(false);
    announce("Changes to the layout were discarded.");
  }

  const undo = () =>
    setHistory((current) =>
      current && current.past.length
        ? { past: current.past.slice(0, -1), present: current.past[current.past.length - 1], future: [current.present, ...current.future] }
        : current,
    );
  const redo = () =>
    setHistory((current) =>
      current && current.future.length ? { past: [...current.past, current.present], present: current.future[0], future: current.future.slice(1) } : current,
    );

  // Keyboard shortcuts for the editing session.
  useEffect(() => {
    if (!creativeMode) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [creativeMode]);

  return (
    <div className={creativeMode ? (breakpoint === "sm" ? "pb-[50vh]" : "pb-36") : ""}>
      {creativeMode ? (
        <div className="sticky top-[var(--header-height)] z-30 mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm">
          <p className="mr-auto font-semibold">
            Creative Mode <span className="mc-hint font-normal">· changes apply when you save</span>
          </p>
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={undo} disabled={!history?.past.length}>
            <Undo2 size={16} aria-hidden="true" /> Undo
          </button>
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={redo} disabled={!history?.future.length}>
            <Redo2 size={16} aria-hidden="true" /> Redo
          </button>
          <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={handleCancel}>
            <X size={16} aria-hidden="true" /> Cancel
          </button>
          <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={handleSave} disabled={saving}>
            <Save size={16} aria-hidden="true" /> {saving ? "Saving…" : "Save layout"}
          </button>
        </div>
      ) : null}

      <div ref={containerRef}>
        {!creativeMode && visibleCount === 0 ? (
          <EmptyState />
        ) : mounted ? (
          creativeMode && visibleCount === 0 ? (
            <div className="mc-grid-guides relative flex min-h-[50vh] items-center justify-center p-6 text-center">
              <p className="mc-hint max-w-sm text-base">
                {breakpoint === "sm" ? "Tap a block in the inventory to add it." : "Drag a block from the inventory below, or press one to add it."}
              </p>
              <DropTarget onDropType={(type) => draggingType && addBlock(type)} draggingType={draggingType} />
            </div>
          ) : (
            <WorkspaceGrid
              blocks={shown}
              width={width}
              breakpoint={breakpoint}
              creative={creativeMode}
              draggingType={draggingType}
              actionsFor={actionsFor}
              onLayoutCommit={(layout: Layout) => {
                if (breakpoint === "sm") return;
                commit(applyGridLayout(withPositions(draft, breakpoint), breakpoint, [...layout]));
              }}
              onDropBlock={(x, y) => {
                if (draggingType) addBlock(draggingType, { x, y });
                setDraggingType(null);
              }}
            />
          )
        ) : null}
      </div>

      {creativeMode ? (
        <InventoryDock
          phone={breakpoint === "sm"}
          hiddenBlocks={draft.filter((block) => block.hidden)}
          onAdd={(type) => addBlock(type)}
          onRestore={(id) => {
            commit(draft.map((block) => (block.id === id ? { ...block, hidden: false } : block)));
            announce("Block shown again.");
          }}
          onDragTypeChange={setDraggingType}
        />
      ) : null}

      <Modal
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => !open && setPendingRemoval(null)}
        title="Remove this block?"
        description="Removing a block only removes this view from your workspace."
        footer={
          <>
            <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setPendingRemoval(null)}>
              Keep it
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-secondary"
              onClick={() => {
                if (pendingRemoval) commit(draft.map((block) => (block.id === pendingRemoval.id ? { ...block, hidden: true } : block)));
                setPendingRemoval(null);
              }}
            >
              Hide instead
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-primary"
              onClick={() => {
                if (pendingRemoval) {
                  commit(draft.filter((block) => block.id !== pendingRemoval.id));
                  announce("Block removed. Your data is still saved.");
                }
                setPendingRemoval(null);
              }}
            >
              Remove block
            </button>
          </>
        }
      >
        <p>
          Your tasks, notes, and events stay saved and keep appearing in other blocks. You can add this block again any time from the
          inventory.
        </p>
      </Modal>
    </div>
  );
}

// Lets the first block be dropped onto an empty grid, where React Grid Layout has no surface yet.
function DropTarget({ onDropType, draggingType }: { onDropType: (type: BlockType) => void; draggingType: BlockType | null }) {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0"
      style={{ pointerEvents: draggingType ? "auto" : "none" }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (draggingType) onDropType(draggingType);
      }}
    />
  );
}
