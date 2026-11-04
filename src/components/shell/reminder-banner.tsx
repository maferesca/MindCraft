"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { addDaysToDateString, browserTimezone, isWithinQuietHours, minutesFromTime } from "@/lib/dates";
import type { NotificationPreferences } from "@/lib/types";
import { useToday } from "../blocks/use-today";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { IconButton } from "../ui/icon-button";

const SHOWN_KEY = "mindcraft-reminder-shown";

const MESSAGES: Record<Exclude<NotificationPreferences["style"], "off">, string> = {
  friendly: "Your space is here whenever you're ready.",
  playful: "Welcome back to your build. Everything is where you left it.",
  minimal: "Welcome back.",
};

// In-app reminders only. They appear inside MindCraft (on return after the
// chosen inactivity period, or at the preferred time while the app is open).
// No background or push notifications are sent. "Off" schedules nothing.
export function ReminderBanner() {
  const { notificationPreferences: prefs, previousVisitDate, profile, updateNotificationPreferences } = useWorkspaceData();
  const { openSettings } = useWorkspaceUI();
  const today = useToday();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!prefs || prefs.style === "off") return;
    const timezone = profile?.timezone ?? browserTimezone();

    const check = () => {
      const now = new Date();
      if (prefs.snoozed_until && new Date(prefs.snoozed_until) > now) return;
      if (isWithinQuietHours(prefs.quiet_hours_start, prefs.quiet_hours_end, now, timezone)) return;
      let alreadyShown: string | null = null;
      try {
        alreadyShown = window.localStorage.getItem(SHOWN_KEY);
      } catch {
        // Storage unavailable.
      }
      if (alreadyShown === today) return;

      const returnedAfterBreak = previousVisitDate !== null && addDaysToDateString(previousVisitDate, prefs.inactivity_days) <= today;
      const preferredMinutes = minutesFromTime(prefs.preferred_time);
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now).split(":").map(Number);
      const reachedPreferredTime = preferredMinutes !== null && (parts[0] % 24) * 60 + parts[1] >= preferredMinutes;

      if (returnedAfterBreak || reachedPreferredTime) {
        setVisible(true);
        try {
          window.localStorage.setItem(SHOWN_KEY, today);
        } catch {
          // Storage unavailable.
        }
      }
    };

    check();
    const interval = window.setInterval(check, 60_000);
    return () => window.clearInterval(interval);
  }, [prefs, previousVisitDate, profile?.timezone, today]);

  if (!visible || !prefs || prefs.style === "off") return null;

  return (
    <div role="status" className="mc-card mb-4 flex flex-wrap items-center gap-2 border-secondary px-4 py-2">
      <p className="flex-1 font-medium">{MESSAGES[prefs.style]}</p>
      <button
        type="button"
        className="mc-btn mc-btn-ghost mc-btn-sm"
        onClick={() => {
          updateNotificationPreferences({ snoozed_until: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString() });
          setVisible(false);
        }}
      >
        Snooze for a week
      </button>
      <button
        type="button"
        className="mc-btn mc-btn-ghost mc-btn-sm"
        onClick={() => {
          updateNotificationPreferences({ style: "off" });
          setVisible(false);
        }}
      >
        Turn off reminders
      </button>
      <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => openSettings("notifications")}>
        Reminder settings
      </button>
      <IconButton size="sm" label="Dismiss reminder" icon={<X size={18} />} onClick={() => setVisible(false)} />
    </div>
  );
}
