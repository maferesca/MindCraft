"use client";

import { useEffect, useState } from "react";
import { browserTimezone, localDateString } from "@/lib/dates";
import { useWorkspaceData } from "../providers/workspace-data";

// The user's local calendar date (yyyy-MM-dd), refreshed each minute so it rolls over at midnight.
export function useToday() {
  const { profile } = useWorkspaceData();
  const timezone = profile?.timezone ?? browserTimezone();
  const [today, setToday] = useState(() => localDateString(timezone));
  useEffect(() => {
    const update = () => setToday(localDateString(timezone));
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [timezone]);
  return today;
}
