const SESSION_KEYS = ["mindcraft-focus-task"];
const SESSION_PREFIXES = ["mindcraft-draft:"];

// Removes one person's unsent text and task selection when they sign out, so the
// next person on this browser never sees it. Proposal outcomes stay: their keys
// are unique message ids, and they keep an applied proposal from being re-applied.
export function clearSessionData(storage: Pick<Storage, "length" | "key" | "removeItem"> = window.localStorage) {
  try {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    for (const key of keys) {
      if (key && (SESSION_KEYS.includes(key) || SESSION_PREFIXES.some((prefix) => key.startsWith(prefix)))) storage.removeItem(key);
    }
  } catch {
    // Storage unavailable: there is nothing saved to clear.
  }
}
