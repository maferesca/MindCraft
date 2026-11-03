import { CalendarDays, ListChecks, NotebookPen, SquareArrowRight, Timer } from "lucide-react";
import type { BlockType } from "@/lib/types";

const ICONS = {
  task_list: ListChecks,
  calendar: CalendarDays,
  next_step: SquareArrowRight,
  focus_timer: Timer,
  notes: NotebookPen,
} satisfies Record<BlockType, unknown>;

const TILE_COLORS: Record<BlockType, string> = {
  task_list: "var(--mc-cube-a)",
  calendar: "var(--mc-cube-b)",
  next_step: "var(--mc-cube-c)",
  focus_timer: "var(--mc-cube-b)",
  notes: "var(--mc-cube-a)",
};

export function BlockIcon({ type, size = 20 }: { type: BlockType; size?: number }) {
  const Icon = ICONS[type];
  return <Icon size={size} aria-hidden="true" />;
}

// Inventory-style tile: a small modular cube face with the block glyph.
export function BlockTile({ type, size = 44 }: { type: BlockType; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-flex shrink-0 items-center justify-center rounded-[10px] border border-border-strong bg-surface text-text"
      style={{ width: size, height: size, boxShadow: `inset 0 -4px 0 ${TILE_COLORS[type]}` }}
    >
      <span className="absolute left-1 top-1 h-1.5 w-1.5 rounded-[2px]" style={{ background: TILE_COLORS[type] }} />
      <BlockIcon type={type} size={Math.round(size * 0.48)} />
    </span>
  );
}
