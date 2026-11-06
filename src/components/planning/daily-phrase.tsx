"use client";

import { Sparkles } from "lucide-react";
import { dailyPhrase } from "@/lib/encouragement";
import { useToday } from "../blocks/use-today";
import { useWorkspaceData } from "../providers/workspace-data";

// Plain text with no live region, so it is read in order and never interrupts.
// The workspace only renders once preferences are loaded, so a saved "off" never flashes.
export function DailyPhrase() {
  const { preferences } = useWorkspaceData();
  const today = useToday();
  if (!preferences.motivationalMessages) return null;
  return (
    <div className="mb-4 flex justify-center">
      <p className="inline-flex items-center gap-2 rounded-2xl bg-primary-soft px-4 py-2 text-center font-semibold text-text sm:rounded-full sm:px-5 sm:text-lg">
        <Sparkles size={18} className="shrink-0 text-primary" aria-hidden="true" />
        {dailyPhrase(today)}
      </p>
    </div>
  );
}
