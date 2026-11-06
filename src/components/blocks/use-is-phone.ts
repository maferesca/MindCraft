"use client";

import { useSyncExternalStore } from "react";

const PHONE_QUERY = "(max-width: 39.99rem)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

// For behavior that differs on a phone. Layout differences belong in CSS.
export function useIsPhone() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}
