"use client";

import { Popover } from "radix-ui";
import { Info } from "lucide-react";
import { catalogItemFor } from "@/lib/block-catalog";
import type { BlockType } from "@/lib/types";

// A popover instead of a hover tooltip, so it also opens by tap and by keyboard.
export function BlockInfo({ type }: { type: BlockType }) {
  const item = catalogItemFor(type);
  return (
    <Popover.Root>
      <Popover.Trigger className="mc-icon-btn mc-icon-btn-sm" aria-label={`About ${item.name}`} title={`About ${item.name}`}>
        <Info size={17} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="mc-menu max-w-xs p-3" side="bottom" align="end" sideOffset={6} collisionPadding={8}>
          <p className="font-semibold">{item.name}</p>
          <p className="mt-1 text-sm">{item.description}</p>
          <p className="mc-hint mt-1">
            <span className="font-semibold">Example:</span> {item.example}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
