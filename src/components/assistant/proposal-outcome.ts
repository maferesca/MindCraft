"use client";

import { useEffect, useState } from "react";

export type Outcome = "pending" | "applied" | "dismissed";

function readOutcome(key: string): Outcome {
  try {
    return (window.localStorage.getItem(`mindcraft-proposal:${key}`) as Outcome) || "pending";
  } catch {
    return "pending";
  }
}

// Remembers on this device what happened to a proposal, so a reload keeps it settled.
export function useProposalOutcome(storageKey: string) {
  const [outcome, setOutcome] = useState<Outcome>("pending");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOutcome(readOutcome(storageKey));
  }, [storageKey]);

  function remember(next: Outcome) {
    setOutcome(next);
    try {
      window.localStorage.setItem(`mindcraft-proposal:${storageKey}`, next);
    } catch {
      // Storage unavailable.
    }
  }

  return [outcome, remember] as const;
}
