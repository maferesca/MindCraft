"use client";

import { X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  tone: "info" | "error";
  action?: { label: string; onClick: () => void };
}

interface NotifyContextValue {
  notify: (message: string, options?: { tone?: Toast["tone"]; action?: Toast["action"]; durationMs?: number }) => void;
  announce: (message: string) => void;
}

const NotifyContext = createContext<NotifyContextValue | null>(null);

// Toasts for visible feedback (with optional Undo) plus a polite live region
// so screen readers hear meaningful results such as "Task added".
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [liveMessage, setLiveMessage] = useState("");
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const announce = useCallback((message: string) => {
    setLiveMessage("");
    window.setTimeout(() => setLiveMessage(message), 50);
  }, []);

  const notify = useCallback<NotifyContextValue["notify"]>(
    (message, options = {}) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-2), { id, message, tone: options.tone ?? "info", action: options.action }]);
      announce(message);
      window.setTimeout(() => dismiss(id), options.durationMs ?? (options.action ? 8000 : 5000));
    },
    [announce, dismiss],
  );

  const value = useMemo(() => ({ notify, announce }), [notify, announce]);

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
            className={`mc-card pointer-events-auto flex max-w-lg items-center gap-3 px-4 py-2 ${toast.tone === "error" ? "border-2 border-danger" : ""}`}
          >
            <p className={toast.tone === "error" ? "font-semibold text-danger" : ""}>{toast.message}</p>
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
