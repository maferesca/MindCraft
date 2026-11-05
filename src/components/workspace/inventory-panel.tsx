"use client";

import { Eye, Plus, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { BLOCK_CATALOG, type CatalogItem } from "@/lib/block-catalog";
import { BLOCK_DEFINITIONS } from "@/lib/blocks";
import type { BlockType, WorkspaceBlock } from "@/lib/types";
import { BlockTile } from "../blocks/block-icon";
import { IconButton } from "../ui/icon-button";
import { BlockPreview } from "./block-preview";

interface InventoryPanelProps {
  hiddenBlocks: WorkspaceBlock[];
  dragging: boolean;
  onAdd: (type: BlockType) => void;
  onRestore: (id: string) => void;
  onDragTypeChange: (type: BlockType | null) => void;
  onClose: () => void;
}

// Sits above the toolbar without blocking the page, because cards are dragged out
// of it onto the grid. While a card is dragged the panel fades and lets the drop
// through. Escape closes it; the toolbar then takes focus back.
export function InventoryPanel({ hiddenBlocks, dragging, onAdd, onRestore, onDragTypeChange, onClose }: InventoryPanelProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="inventory-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
      className={`fixed inset-x-2 bottom-[4.75rem] z-40 mx-auto flex max-h-[calc(100dvh-var(--header-height)-6rem)] max-w-5xl flex-col rounded-2xl border border-border-strong bg-surface shadow-2xl transition-opacity ${
        dragging ? "pointer-events-none opacity-25" : ""
      }`}
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h2 id="inventory-title" className="flex-1 text-lg font-bold">
          Inventory
        </h2>
        <IconButton ref={closeRef} size="sm" label="Close inventory" icon={<X size={18} />} onClick={onClose} />
      </header>

      <div className="flex flex-col gap-4 overflow-y-auto p-4">
        {hiddenBlocks.length ? (
          <section aria-labelledby="inventory-hidden">
            <h3 id="inventory-hidden" className="mb-2 font-bold">
              Hidden
            </h3>
            <ul className="flex flex-wrap gap-2">
              {hiddenBlocks.map((block) => {
                const label = block.title || BLOCK_DEFINITIONS[block.block_type].label;
                return (
                  <li key={block.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onRestore(block.id);
                        // This button disappears, so keep focus inside the panel.
                        closeRef.current?.focus();
                      }}
                      className="mc-btn mc-btn-secondary mc-btn-sm"
                      aria-label={`Show hidden ${label} block`}
                    >
                      <Eye size={14} aria-hidden="true" /> {label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {BLOCK_CATALOG.map((category) => (
          <section key={category.id} aria-labelledby={`inventory-${category.id}`}>
            <h3 id={`inventory-${category.id}`} className="mb-2 font-bold">
              {category.label}
            </h3>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
              {category.items.map((item) => (
                <li key={item.id}>
                  <InventoryCard item={item} onAdd={onAdd} onDragTypeChange={onDragTypeChange} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  );
}

function InventoryCard({ item, onAdd, onDragTypeChange }: { item: CatalogItem; onAdd: InventoryPanelProps["onAdd"]; onDragTypeChange: InventoryPanelProps["onDragTypeChange"] }) {
  const type = item.blockType;
  return (
    <article
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", type);
        event.dataTransfer.effectAllowed = "copy";
        onDragTypeChange(type);
      }}
      onDragEnd={() => onDragTypeChange(null)}
      className="flex h-full cursor-grab flex-col gap-2 rounded-xl border border-border bg-surface p-3 hover:border-border-strong active:cursor-grabbing"
    >
      <div className="flex items-center gap-2">
        <BlockTile type={type} size={36} />
        <h4 className="min-w-0 flex-1 font-bold leading-tight">{item.name}</h4>
      </div>
      <p className="text-sm leading-snug">{item.description}</p>
      <p className="mc-hint leading-snug">
        <span className="font-semibold">Example:</span> {item.example}
      </p>
      <BlockPreview id={item.id} />
      {item.options.length ? (
        <p className="mc-hint leading-snug">
          <span className="font-semibold">Options:</span> {item.options.join(" · ")}
        </p>
      ) : null}
      {item.planned.length ? (
        <p className="mc-hint leading-snug">
          <span className="font-semibold">Not built yet:</span> {item.planned.join(" · ")}
        </p>
      ) : null}
      <button
        type="button"
        className="mc-btn mc-btn-secondary mc-btn-sm mt-auto"
        aria-label={`Add ${item.name} block`}
        onClick={() => onAdd(type)}
      >
        <Plus size={14} aria-hidden="true" /> Add block
      </button>
    </article>
  );
}
