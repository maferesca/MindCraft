"use client";

import { Tooltip } from "radix-ui";
import { ChevronLeft, ChevronRight, LayoutGrid, MessageCircle } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BLOCK_DEFINITIONS, BLOCK_ORDER } from "@/lib/blocks";
import type { BlockType, WorkspaceBlock } from "@/lib/types";
import { BlockTile } from "../blocks/block-icon";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { IconButton } from "../ui/icon-button";
import { InventoryPanel } from "./inventory-panel";

interface InventoryDockProps {
  phone: boolean;
  hiddenBlocks: WorkspaceBlock[];
  draggingType: BlockType | null;
  onAdd: (type: BlockType) => void;
  onRestore: (id: string) => void;
  onDragTypeChange: (type: BlockType | null) => void;
}

// Creative Mode toolbar, organized like a game hotbar: numbered slots to click or
// drag, and an inventory panel with the details. Arrow keys move between slots;
// Enter, Space, or the slot's number adds the block.
export function InventoryDock({ phone, hiddenBlocks, draggingType, onAdd, onRestore, onDragTypeChange }: InventoryDockProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [selected, setSelected] = useState<BlockType | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const { openAssistant } = useWorkspaceUI();

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () => setOverflow({ left: row.scrollLeft > 4, right: row.scrollLeft + row.clientWidth < row.scrollWidth - 4 });
    update();
    row.addEventListener("scroll", update);
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, []);

  const scroll = (direction: -1 | 1) => rowRef.current?.scrollBy({ left: direction * 200, behavior: "smooth" });

  function closeInventory() {
    setInventoryOpen(false);
    openButtonRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const slot = Number(event.key);
    if (slot >= 1 && slot <= BLOCK_ORDER.length) {
      const type = BLOCK_ORDER[slot - 1];
      event.preventDefault();
      setSelected(type);
      onAdd(type);
      return;
    }
    const items = [...(toolbarRef.current?.querySelectorAll<HTMLElement>("[data-toolbar-item]") ?? [])];
    const moves: Record<string, number> = {
      ArrowRight: (activeIndex + 1) % items.length,
      ArrowLeft: (activeIndex - 1 + items.length) % items.length,
      Home: 0,
      End: items.length - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActiveIndex(next);
    items[next]?.focus();
  }

  return (
    <>
      {inventoryOpen ? (
        <InventoryPanel
          hiddenBlocks={hiddenBlocks}
          dragging={draggingType !== null}
          onAdd={onAdd}
          onRestore={onRestore}
          onDragTypeChange={onDragTypeChange}
          onClose={closeInventory}
        />
      ) : null}

      <section aria-label="Block toolbar" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 px-3 py-2 shadow-[0_-8px_24px_rgb(20_16_12/0.10)] backdrop-blur">
        <div ref={toolbarRef} role="toolbar" aria-label="Add blocks" onKeyDown={handleKeyDown} className="mx-auto flex max-w-[1400px] items-center justify-center gap-2">
          {overflow.left ? <IconButton size="sm" label="Scroll blocks left" icon={<ChevronLeft size={18} />} onClick={() => scroll(-1)} tooltipSide="top" tabIndex={-1} /> : null}
          <div ref={rowRef} className="min-w-0 overflow-x-auto [scrollbar-width:none]">
            <ul className="flex w-max gap-1 rounded-xl bg-surface-muted p-1">
              {BLOCK_ORDER.map((type, index) => {
                const label = BLOCK_DEFINITIONS[type].label;
                const isSelected = selected === type || draggingType === type;
                return (
                  <li key={type}>
                    <Tooltip.Root>
                      <Tooltip.Trigger asChild>
                        <button
                          type="button"
                          data-toolbar-item
                          tabIndex={activeIndex === index ? 0 : -1}
                          draggable={!phone}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", type);
                            event.dataTransfer.effectAllowed = "copy";
                            setSelected(type);
                            onDragTypeChange(type);
                          }}
                          onDragEnd={() => onDragTypeChange(null)}
                          onFocus={() => setActiveIndex(index)}
                          onClick={() => {
                            setSelected(type);
                            onAdd(type);
                          }}
                          aria-label={`Add ${label} block`}
                          aria-current={isSelected ? "true" : undefined}
                          className={`relative flex h-11 items-center gap-2 rounded-lg border-2 pl-1 pr-2.5 text-sm font-semibold whitespace-nowrap ${
                            isSelected ? "border-primary bg-primary-soft" : "border-transparent bg-surface hover:border-border-strong"
                          }`}
                        >
                          <BlockTile type={type} size={30} />
                          {label}
                          {phone ? null : (
                            <span aria-hidden="true" className="absolute right-1 top-0.5 text-[0.625rem] leading-none text-text-muted">
                              {index + 1}
                            </span>
                          )}
                        </button>
                      </Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Content side="top" sideOffset={8} className="mc-tooltip">
                          {phone ? `Add ${label}` : `Click or drag to add ${label}`}
                        </Tooltip.Content>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  </li>
                );
              })}
            </ul>
          </div>
          {overflow.right ? <IconButton size="sm" label="Scroll blocks right" icon={<ChevronRight size={18} />} onClick={() => scroll(1)} tooltipSide="top" tabIndex={-1} /> : null}

          <button
            ref={openButtonRef}
            type="button"
            data-toolbar-item
            tabIndex={activeIndex === BLOCK_ORDER.length ? 0 : -1}
            onFocus={() => setActiveIndex(BLOCK_ORDER.length)}
            aria-expanded={inventoryOpen}
            className="mc-btn mc-btn-secondary mc-btn-sm h-11 shrink-0 whitespace-nowrap"
            onClick={() => (inventoryOpen ? closeInventory() : setInventoryOpen(true))}
          >
            <LayoutGrid size={16} aria-hidden="true" />
            {inventoryOpen ? "Close inventory" : "Open inventory"}
            {hiddenBlocks.length ? <span className="mc-chip">{hiddenBlocks.length} hidden</span> : null}
          </button>

          {phone ? null : (
            <>
              <span className="h-8 w-px shrink-0 bg-border" aria-hidden="true" />
              <IconButton label="Open assistant" icon={<MessageCircle size={20} />} onClick={() => openAssistant()} tooltipSide="top" tabIndex={-1} />
            </>
          )}
        </div>
      </section>
    </>
  );
}
