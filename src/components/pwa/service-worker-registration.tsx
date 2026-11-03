"use client";

import { useEffect } from "react";

// Registers the service worker in production builds. It caches the app shell
// and shows an offline page; it does not provide offline editing or push.
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installation is optional; the app works without it.
    });
  }, []);
  return null;
}
