"use client";

import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { restoreFocus } from "./restore-focus";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  footer?: ReactNode;
}

// Accessible dialog: focus is trapped, Escape closes, focus returns on close.
export function Modal({ open, onOpenChange, ...surface }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {open ? <ModalSurface {...surface} /> : null}
    </Dialog.Root>
  );
}

function ModalSurface({ title, description, children, wide, footer }: Omit<ModalProps, "open" | "onOpenChange">) {
  // Read while rendering, before an autoFocus field inside the dialog takes focus.
  // These dialogs have no Dialog.Trigger, so Radix has nothing to return focus to.
  const [opener] = useState(() => (document.activeElement instanceof HTMLElement ? document.activeElement : null));

  return (
    <Dialog.Portal>
      <Dialog.Overlay className="mc-overlay" />
      <Dialog.Content
        className={`mc-dialog ${wide ? "mc-dialog-wide" : ""}`}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus(opener);
        }}
        onEscapeKeyDown={(event) => {
          // Radix listens on the document in the capture phase, so a field that
          // uses Escape for itself opts out here instead of stopping propagation.
          if (event.target instanceof Element && event.target.closest("[data-local-escape]")) event.preventDefault();
        }}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="text-xl font-bold leading-snug">{title}</Dialog.Title>
            {description ? (
              <Dialog.Description className="mc-hint mt-1">{description}</Dialog.Description>
            ) : (
              <Dialog.Description className="sr-only">{title}</Dialog.Description>
            )}
          </div>
          <Dialog.Close className="mc-icon-btn mc-icon-btn-sm -mr-2 -mt-1" aria-label="Close">
            <X size={20} aria-hidden="true" />
          </Dialog.Close>
        </div>
        {children}
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
