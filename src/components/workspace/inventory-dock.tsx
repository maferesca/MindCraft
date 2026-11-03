"use client";

import { ChevronLeft, ChevronRight, ChevronUp, Eye, MessageCircle, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BLOCK_DEFINITIONS, BLOCK_ORDER } from "@/lib/blocks";
import type { BlockType, WorkspaceBlock } from "@/lib/types";
import { BlockTile } from "../blocks/block-icon";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { IconButton } from "../ui/icon-button";

interface InventoryDockProps {
  phone: boolean;
  hiddenBlocks: WorkspaceBlock[];
  onAdd: (type: BlockType) => void;
  onRestore: (id: string) => void;
  onDragTypeChange: (type: BlockType | null) => void;
}

// Bottom inventory in Creative Mode. Drag a tile onto the grid, or press it to add.
// On phones it becomes a collapsible bottom sheet with tap-to-add.
export function InventoryDock({ phone, hiddenBlocks, onAdd, onRestore, onDragTypeChange }: InventoryDockProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [sheetOpen, setSheetOpen] = useState(true);
  const { openAssistant } = useWorkspaceUI();

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () =>
      setOverflow({ left: row.scrollLeft > 4, right: row.scrollLeft + row.clientWidth < row.scrollWidth - 4 });
    update();
    row.addEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [phone, sheetOpen, hiddenBlocks.length]);

  const scroll = (direction: -1 | 1) => rowRef.current?.scrollBy({ left: direction * 240, behavior: "smooth" });

  const items = (
    <>
      {BLOCK_ORDER.map((type) => (
        <li key={type} className="shrink-0">
          <button
            type="button"
            draggable={!phone}
            onDragStart={(event) => {
              event.dataTransfer.setData("text/plain", type);
              event.dataTransfer.effectAllowed = "copy";
              onDragTypeChange(type);
            }}
            onDragEnd={() => onDragTypeChange(null)}
            onClick={() => onAdd(type)}
            className="group flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 text-left hover:border-border-strong hover:bg-surface-muted"
            aria-label={`Add ${BLOCK_DEFINITIONS[type].label} block`}
            title={BLOCK_DEFINITIONS[type].description}
          >
            <BlockTile type={type} size={40} />
            <span className="flex flex-col">
              <span className="font-semibold leading-tight">{BLOCK_DEFINITIONS[type].label}</span>
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <Plus size={12} aria-hidden="true" /> {phone ? "Tap to add" : "Add or drag"}
              </span>
            </span>
          </button>
        </li>
      ))}
      {hiddenBlocks.map((block) => (
        <li key={block.id} className="shrink-0">
          <button
            type="button"
            onClick={() => onRestore(block.id)}
            className="flex min-h-16 items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface px-3 py-2 text-left hover:bg-surface-muted"
            aria-label={`Show hidden ${block.title || BLOCK_DEFINITIONS[block.block_type].label} block`}
          >
            <BlockTile type={block.block_type} size={40} />
            <span className="flex flex-col">
              <span className="font-semibold leading-tight">{block.title || BLOCK_DEFINITIONS[block.block_type].label}</span>
              <span className="inline-flex items-center gap-1 text-xs text-text-muted">
                <Eye size={12} aria-hidden="true" /> Hidden · show
              </span>
            </span>
          </button>
        </li>
      ))}
    </>
  );

  if (phone) {
    return (
      <section aria-label="Block inventory" className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-border bg-surface shadow-[0_-8px_24px_rgb(20_16_12/0.12)]">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 font-semibold"
          aria-expanded={sheetOpen}
          onClick={() => setSheetOpen((open) => !open)}
        >
          Inventory
          <ChevronUp size={20} aria-hidden="true" className={sheetOpen ? "rotate-180" : ""} />
        </button>
        {sheetOpen ? (
          <ul className="grid max-h-[40vh] grid-cols-1 gap-2 overflow-y-auto px-4 pb-4 min-[400px]:grid-cols-2">{items}</ul>
        ) : null}
      </section>
    );
  }

  return (
    <section
      aria-label="Block inventory"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-4 py-3 shadow-[0_-8px_24px_rgb(20_16_12/0.10)] backdrop-blur"
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-2">
        <span className="hidden shrink-0 pr-2 text-sm font-bold text-text-muted lg:inline">Inventory</span>
        <IconButton label="Scroll inventory left" icon={<ChevronLeft size={20} />} disabled={!overflow.left} onClick={() => scroll(-1)} tooltipSide="top" />
        <div ref={rowRef} className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:thin]">
          <ul className="flex gap-2">{items}</ul>
        </div>
        <IconButton label="Scroll inventory right" icon={<ChevronRight size={20} />} disabled={!overflow.right} onClick={() => scroll(1)} tooltipSide="top" />
        <span className="mx-1 h-10 w-px bg-border" aria-hidden="true" />
        <IconButton label="Open assistant" icon={<MessageCircle size={20} />} onClick={() => openAssistant()} tooltipSide="top" />
      </div>
    </section>
  );
}
