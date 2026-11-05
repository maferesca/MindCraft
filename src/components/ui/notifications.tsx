"use client";

import { Sparkles, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  tone: "info" | "error" | "encouragement";
  action?: { label: string; onClick: () => void };
  group?: string;
}

interface NotifyOptions {
  tone?: Toast["tone"];
  action?: Toast["action"];
  durationMs?: number;
  // Lets a whole kind of message be removed at once.
  group?: string;
  // For optional messages: stay silent while another message is showing.
  onlyIfQuiet?: boolean;
}

interface NotifyContextValue {
  notify: (message: string, options?: NotifyOptions) => void;
  announce: (message: string) => void;
  dismissGroup: (group: string) => void;
}

const NotifyContext = createContext<NotifyContextValue | null>(null);

const TOAST_STYLES: Record<Toast["tone"], string> = {
  info: "px-4 py-2",
  error: "border-2 border-danger px-4 py-2",
  encouragement: "border-2 border-primary bg-primary-soft px-5 py-3",
};

// Toasts for visible feedback (with optional Undo) plus a polite live region
// so screen readers hear meaningful results such as "Task added".
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [liveMessage, setLiveMessage] = useState("");
  const nextId = useRef(1);
  // The latest list, for deciding before React has rendered the last change.
  const toastsRef = useRef<Toast[]>([]);

  const updateToasts = useCallback((next: Toast[]) => {
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const dismiss = useCallback((id: number) => updateToasts(toastsRef.current.filter((toast) => toast.id !== id)), [updateToasts]);
  const dismissGroup = useCallback((group: string) => updateToasts(toastsRef.current.filter((toast) => toast.group !== group)), [updateToasts]);

  const announce = useCallback((message: string) => {
    setLiveMessage("");
    window.setTimeout(() => setLiveMessage(message), 50);
  }, []);

  const notify = useCallback<NotifyContextValue["notify"]>(
    (message, options = {}) => {
      if (options.onlyIfQuiet && toastsRef.current.length) return;
      const id = nextId.current++;
      updateToasts([...toastsRef.current.slice(-2), { id, message, tone: options.tone ?? "info", action: options.action, group: options.group }]);
      announce(message);
      window.setTimeout(() => dismiss(id), options.durationMs ?? (options.action ? 8000 : 5000));
    },
    [announce, dismiss, updateToasts],
  );

  const value = useMemo(() => ({ notify, announce, dismissGroup }), [notify, announce, dismissGroup]);

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex flex-col items-center gap-2 px-4">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`mc-card pointer-events-auto flex max-w-lg items-center gap-3 shadow-lg ${TOAST_STYLES[toast.tone]}`}
          >
            {toast.tone === "encouragement" ? <Sparkles size={20} className="shrink-0 text-primary" aria-hidden="true" /> : null}
            <p className={toast.tone === "error" ? "font-semibold text-danger" : toast.tone === "encouragement" ? "text-lg font-semibold" : "font-medium"}>{toast.message}</p>
            {toast.action ? (
              <button
                type="button"
                className="mc-btn mc-btn-secondary mc-btn-sm"
                onClick={() => {
                  toast.action?.onClick();
                  dismiss(toast.id);
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
            <button type="button" className="mc-icon-btn mc-icon-btn-sm" aria-label="Dismiss message" onClick={() => dismiss(toast.id)}>
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </NotifyContext.Provider>
  );
}

export function useNotify() {
  const value = useContext(NotifyContext);
  if (!value) throw new Error("useNotify must be used inside NotificationsProvider");
  return value;
}
