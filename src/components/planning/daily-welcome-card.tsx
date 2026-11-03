"use client";

import { X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { VoiceRecorder } from "../assistant/voice-recorder";
import { useToday } from "../blocks/use-today";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { IconButton } from "../ui/icon-button";

const DISMISSED_KEY = "mindcraft-welcome-dismissed";

// Small, dismissible card on the first visit of each local day.
// It never blocks the workspace and is not a required daily interview.
export function DailyWelcomeCard() {
  const { preferences, tasks } = useWorkspaceData();
  const { openPlanning, openAssistant, setSearchOpen, focusTaskId } = useWorkspaceUI();
  const today = useToday();
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    let dismissed: string | null = null;
    try {
      dismissed = window.localStorage.getItem(DISMISSED_KEY);
    } catch {
      // Storage unavailable: show the card.
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(preferences.dailyWelcome && dismissed !== today);
  }, [preferences.dailyWelcome, today]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, today);
    } catch {
      // Storage unavailable.
    }
  }

  if (!visible) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    openPlanning(text.trim());
    dismiss();
  }

  const startTaskId = focusTaskId ?? tasks.find((task) => task.status === "in_progress")?.id ?? null;
  const options = [
    { label: "Organize my tasks", action: () => openPlanning("Help me organize my tasks for today.") },
    {
      label: "Help me start",
      action: () =>
        startTaskId
          ? openAssistant({ mode: "help_me_start", taskId: startTaskId, autoSend: true })
          : openAssistant({ mode: "chat", message: "I'd like help getting started on something." }),
    },
    { label: "Find something in my workspace", action: () => setSearchOpen(true) },
    { label: "Keep my space as it is", action: () => undefined },
  ];

  return (
    <section aria-labelledby="welcome-heading" className="mc-card mb-5 p-4">
      <div className="flex items-start gap-2">
        <h2 id="welcome-heading" className="flex-1 text-lg font-bold">
          What do you have in mind today?
        </h2>
        <IconButton size="sm" label="Dismiss for today" icon={<X size={18} />} onClick={dismiss} />
      </div>
      <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="welcome-text" className="sr-only">
          Type a message
        </label>
        <input id="welcome-text" className="mc-input" placeholder="Type a message…" maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} />
        <button type="submit" className="mc-btn mc-btn-primary shrink-0" disabled={!text.trim()}>
          Continue
        </button>
      </form>
      <div className="mt-2">
        <VoiceRecorder onTranscript={(transcript) => setText((current) => (current ? `${current} ${transcript}` : transcript))} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            className="mc-btn mc-btn-secondary mc-btn-sm rounded-full"
            onClick={() => {
              option.action();
              dismiss();
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </section>
  );
}
