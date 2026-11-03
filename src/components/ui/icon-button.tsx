"use client";

import { Tooltip } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
  size?: "md" | "sm";
  tooltipSide?: "top" | "bottom" | "left" | "right";
}

// Every icon-only control has an accessible name and a visible tooltip
// that appears on hover and on keyboard focus.
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, size = "md", tooltipSide = "bottom", className = "", ...props },
  ref,
) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          ref={ref}
          type="button"
          aria-label={label}
          className={`mc-icon-btn ${size === "sm" ? "mc-icon-btn-sm" : ""} ${className}`}
          {...props}
        >
          {icon}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={tooltipSide} sideOffset={6} className="mc-tooltip">
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
});

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={100}>
      {children}
    </Tooltip.Provider>
  );
}
