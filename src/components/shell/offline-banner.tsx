"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

// Honest offline state: changes are not queued for later sync.
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-text px-4 py-2 text-center text-background">
      <WifiOff size={16} aria-hidden="true" />
      You&apos;re offline. Changes can&apos;t be saved until you reconnect. Text you type in planning and chat is kept on this device.
    </div>
  );
}
