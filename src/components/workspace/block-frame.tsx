"use client";

import { DropdownMenu } from "radix-ui";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ChevronDown, ChevronUp, EyeOff, GripVertical, Link2, Maximize2, Minimize2, Minus, MoreHorizontal, Trash2, Unlink } from "lucide-react";
import type { ReactNode } from "react";
import { BLOCK_DEFINITIONS } from "@/lib/blocks";
import { SIZE_LABELS, currentSizePreset, type SizePreset } from "@/lib/layout-edit";
import type { Breakpoint, WorkspaceBlock } from "@/lib/types";
import { BlockIcon, blockHeaderBackground } from "../blocks/block-icon";
import { useWorkspaceData } from "../providers/workspace-data";
import { IconButton } from "../ui/icon-button";
import { BlockDetails } from "./block-details";
import { BlockInfo } from "./block-info";

export interface CreativeActions {
  moveEarlier: () => void;
  moveLater: () => void;
  resize: (preset: SizePreset) => void;
  nudge: (dx: number, dy: number) => void;
  hide: () => void;
  remove: () => void;
  isFirst: boolean;
  isLast: boolean;
  grouped: boolean;
  // Groups to join, and single blocks to start a group with.
  groupTargets: Array<{ blockId: string; label: string }>;
  joinGroup: (targetBlockId: string) => void;
  leaveGroup: () => void;
}

interface BlockFrameProps {
  block: WorkspaceBlock;
  breakpoint: Breakpoint | "sm";
  creative: CreativeActions | null;
  maximized?: boolean;
  // Absent in Creative Mode, where every block must stay visible to arrange it.
  onToggleMaximize?: () => void;
  children: ReactNode;
}

// Card around every block. In Creative Mode only the header grip starts a
// drag; text fields, checkboxes, and scrolling inside the block never move it.
export function BlockFrame({ block, breakpoint, creative, maximized = false, onToggleMaximize, children }: BlockFrameProps) {
  const { updateBlockConfig } = useWorkspaceData();
  const definition = BLOCK_DEFINITIONS[block.block_type];
  const title = block.title || definition.label;
  const headingId = `block-heading-${block.id}`;

  return (
    <section
      aria-labelledby={headingId}
      className={`mc-card flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden ${creative ? "outline-2 outline-dashed outline-offset-2 outline-border-strong" : ""}`}
    >
      <header
        className={`flex items-center gap-2 border-b border-border px-3 py-1.5 ${creative ? "bg-surface-muted" : ""}`}
        style={creative ? undefined : { background: blockHeaderBackground(block.block_type) }}
      >
        {creative && breakpoint !== "sm" ? (
          <span
            className="mc-drag-handle -ml-1 inline-flex h-9 w-7 cursor-grab items-center justify-center rounded-md text-text-muted hover:bg-background active:cursor-grabbing"
            title="Drag to move"
            aria-hidden="true"
          >
            <GripVertical size={18} />
          </span>
        ) : null}
        <BlockIcon type={block.block_type} size={18} />
        <h3 id={headingId} className={`min-w-0 flex-1 truncate font-bold ${creative && breakpoint !== "sm" ? "mc-drag-handle cursor-grab" : ""}`}>
          {title}
        </h3>
        {creative ? <CreativeControls block={block} breakpoint={breakpoint} actions={creative} title={title} /> : null}
        <div className="flex items-center gap-0.5">
          {block.block_type === "task_list" || block.block_type === "focus_timer" ? <BlockDetails block={block} /> : null}
          {/* Creative Mode needs the room for a readable title; the inventory explains each block. */}
          {creative ? null : <BlockInfo type={block.block_type} />}
          {!maximized && !creative ? (
            <IconButton
              size="sm"
              label={`Minimize ${title}`}
              icon={<Minus size={18} />}
              data-minimize-block={block.id}
              onClick={() => {
                updateBlockConfig(block.id, { minimized: true });
                focusAfterRender(`[data-restore-block="${block.id}"]`);
              }}
            />
          ) : null}
          {onToggleMaximize ? (
            <IconButton
              size="sm"
              label={maximized ? `Exit full size for ${title}` : `Maximize ${title}`}
              icon={maximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              autoFocus={maximized}
              data-maximize-block={block.id}
              onClick={onToggleMaximize}
            />
          ) : null}
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-[var(--space)]">{children}</div>
    </section>
  );
}

// The control that opened this change disappears, so focus moves to its counterpart.
export function focusAfterRender(selector: string) {
  window.setTimeout(() => document.querySelector<HTMLElement>(selector)?.focus(), 50);
}

function CreativeControls({ block, breakpoint, actions, title }: { block: WorkspaceBlock; breakpoint: Breakpoint | "sm"; actions: CreativeActions; title: string }) {
  const preset = breakpoint === "sm" ? "" : currentSizePreset(block.layouts[breakpoint], breakpoint);
  return (
    <div className="flex items-center gap-0.5">
      {/* aria-disabled, not disabled: a button that reaches the end must keep keyboard focus. */}
      <IconButton
        size="sm"
        label={`Move ${title} earlier`}
        icon={<ChevronUp size={18} />}
        aria-disabled={actions.isFirst}
        onClick={actions.isFirst ? undefined : actions.moveEarlier}
      />
      <IconButton
        size="sm"
        label={`Move ${title} later`}
        icon={<ChevronDown size={18} />}
        aria-disabled={actions.isLast}
        onClick={actions.isLast ? undefined : actions.moveLater}
      />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="mc-icon-btn mc-icon-btn-sm" aria-label={`Layout options for ${title}`} title="Layout options">
          <MoreHorizontal size={18} aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="mc-menu" align="end" sideOffset={4}>
            {breakpoint !== "sm" ? (
              <>
                <DropdownMenu.Label className="mc-hint px-2 py-1">Size</DropdownMenu.Label>
                <DropdownMenu.RadioGroup value={preset} onValueChange={(value) => actions.resize(value as SizePreset)}>
                  {(Object.keys(SIZE_LABELS) as SizePreset[]).map((option) => (
                    <DropdownMenu.RadioItem key={option} value={option} className="mc-menu-item">
                      <span className="inline-block w-4" aria-hidden="true">{preset === option ? "✓" : ""}</span>
                      {SIZE_LABELS[option]}
                    </DropdownMenu.RadioItem>
                  ))}
                </DropdownMenu.RadioGroup>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
                <DropdownMenu.Label className="mc-hint px-2 py-1">Position</DropdownMenu.Label>
                <DropdownMenu.Item className="mc-menu-item" onSelect={(event) => { event.preventDefault(); actions.nudge(-1, 0); }}>
                  <ArrowLeft size={16} aria-hidden="true" /> Move left
                </DropdownMenu.Item>
                <DropdownMenu.Item className="mc-menu-item" onSelect={(event) => { event.preventDefault(); actions.nudge(1, 0); }}>
                  <ArrowRight size={16} aria-hidden="true" /> Move right
                </DropdownMenu.Item>
                <DropdownMenu.Item className="mc-menu-item" onSelect={(event) => { event.preventDefault(); actions.nudge(0, -1); }}>
                  <ArrowUp size={16} aria-hidden="true" /> Move up
                </DropdownMenu.Item>
                <DropdownMenu.Item className="mc-menu-item" onSelect={(event) => { event.preventDefault(); actions.nudge(0, 1); }}>
                  <ArrowDown size={16} aria-hidden="true" /> Move down
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-border" />
              </>
            ) : null}
            {actions.grouped ? (
              <DropdownMenu.Item className="mc-menu-item" onSelect={actions.leaveGroup}>
                <Unlink size={16} aria-hidden="true" /> Remove from group
              </DropdownMenu.Item>
            ) : null}
            {!actions.grouped && actions.groupTargets.length ? <DropdownMenu.Label className="mc-hint px-2 py-1">Add to group</DropdownMenu.Label> : null}
            {!actions.grouped
              ? actions.groupTargets.map((target) => (
                  <DropdownMenu.Item key={target.blockId} className="mc-menu-item" onSelect={() => actions.joinGroup(target.blockId)}>
                    <Link2 size={16} aria-hidden="true" /> {target.label}
                  </DropdownMenu.Item>
                ))
              : null}
            {actions.grouped || actions.groupTargets.length ? <DropdownMenu.Separator className="my-1 h-px bg-border" /> : null}
            <DropdownMenu.Item className="mc-menu-item" onSelect={actions.hide}>
              <EyeOff size={16} aria-hidden="true" /> Hide block
            </DropdownMenu.Item>
            <DropdownMenu.Item className="mc-menu-item text-danger" onSelect={actions.remove}>
              <Trash2 size={16} aria-hidden="true" /> Remove block
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
