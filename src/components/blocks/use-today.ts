"use client";

import { useEffect, useState } from "react";
import { browserTimezone, localDateString } from "@/lib/dates";
import { useWorkspaceData } from "../providers/workspace-data";

// The timezone saved on the profile. Dates and times display in it everywhere.
export function useTimezone() {
  const { profile } = useWorkspaceData();
  return profile?.timezone ?? browserTimezone();
}

// The user's local calendar date (yyyy-MM-dd), refreshed each minute so it rolls over at midnight.
export function useToday() {
  const timezone = useTimezone();
  const [today, setToday] = useState(() => localDateString(timezone));
  useEffect(() => {
    const update = () => setToday(localDateString(timezone));
    update();
    const interval = window.setInterval(update, 60_000);
    return () => window.clearInterval(interval);
  }, [timezone]);
  return today;
}
