"use client";

import { Coffee, Play } from "lucide-react";
import { useState } from "react";
import type { HelpRequest } from "@/lib/schemas";
import type { Task } from "@/lib/types";
import { useTimer } from "../providers/timer";
import { useWorkspaceUI } from "../providers/workspace-ui";

const SHORT_SESSION_MINUTES = 10;

const OPTIONS: Array<{ id: HelpRequest; label: string; message: (title: string) => string }> = [
  { id: "where_to_begin", label: "I don't know where to begin", message: (title) => `I don't know where to begin with "${title}".` },
  { id: "overwhelmed", label: "I feel overwhelmed", message: (title) => `"${title}" feels like too much right now.` },
  { id: "distracted", label: "I keep getting distracted", message: (title) => `I keep getting distracted from "${title}".` },
  { id: "tired", label: "I'm tired or unmotivated", message: (title) => `I'm tired or unmotivated for "${title}" right now.` },
  { id: "missing_information", label: "I'm missing information", message: (title) => `I'm missing information for "${title}".` },
];

// Each option asks the existing assistant about the selected task. The answer appears
// in the assistant panel, and nothing starts or changes until the person chooses it.
export function StartSupport({ task, onShowTimer }: { task: Task; onShowTimer: () => void }) {
  const { openAssistant } = useWorkspaceUI();
  const timer = useTimer();
  const [chosen, setChosen] = useState<HelpRequest | null>(null);
  const idle = timer.session.runState === "idle";

  function choose(option: (typeof OPTIONS)[number]) {
    setChosen(option.id);
    if (option.id === "distracted" || option.id === "tired") onShowTimer();
    openAssistant({
      mode: option.id === "missing_information" ? "missing_information" : "help_me_start",
      taskId: task.id,
      autoSend: true,
      helpRequest: option.id,
      message: option.message(task.title),
    });
  }

  return (
    <section aria-labelledby="start-support-title">
      <h4 id="start-support-title" className="font-semibold">
        What&apos;s making it hard to start?
      </h4>
      <div className="mt-2 flex flex-wrap gap-2">
        {OPTIONS.map((option) => (
          <button key={option.id} type="button" aria-pressed={chosen === option.id} className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => choose(option)}>
            {option.label}
          </button>
        ))}
      </div>
      {chosen === "distracted" && idle ? (
        <button type="button" className="mc-btn mc-btn-primary mc-btn-sm mt-2" onClick={() => timer.startShortSession(SHORT_SESSION_MINUTES, task.id)}>
          <Play size={16} aria-hidden="true" /> Start a {SHORT_SESSION_MINUTES}-minute session
        </button>
      ) : null}
      {chosen === "tired" && idle ? (
        <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm mt-2" onClick={timer.startBreak}>
          <Coffee size={16} aria-hidden="true" /> Start a short break
        </button>
      ) : null}
    </section>
  );
}
