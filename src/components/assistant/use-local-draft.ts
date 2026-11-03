"use client";

import { useEffect, useState } from "react";

// Keeps unsent text on this device so a refresh, an offline moment, or an AI
// failure never loses what the user typed.
export function useLocalDraft(key: string, initial = "") {
  const storageKey = `mindcraft-draft:${key}`;
  const [value, setValue] = useState(initial);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      // Restore after hydration so server and client render the same markup.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved && !initial) setValue(saved);
    } catch {
      // Storage unavailable.
    }
  }, [storageKey, initial]);

  useEffect(() => {
    try {
      if (value) window.localStorage.setItem(storageKey, value);
      else window.localStorage.removeItem(storageKey);
    } catch {
      // Storage unavailable.
    }
  }, [storageKey, value]);

  return [value, setValue] as const;
}
