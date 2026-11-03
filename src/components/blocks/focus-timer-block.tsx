"use client";

import { Coffee, Pause, Play, RotateCcw, Square } from "lucide-react";
import { useState } from "react";
import { formatDuration, useTimer } from "../providers/timer";
import { useWorkspaceData } from "../providers/workspace-data";

// Optional focus sessions. Starts only when the user presses Start.
export function FocusTimerBlock({ compact = false }: { compact?: boolean }) {
  const timer = useTimer();
  const { preferences } = useWorkspaceData();
  const [customMinutes, setCustomMinutes] = useState(String(preferences.workMinutes));
  const idle = timer.runState === "idle";
  const progress = timer.durationMs ? 1 - timer.remainingMs / timer.durationMs : 0;

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="text-center">
        <p className="text-sm font-semibold text-text-muted">{timer.phase === "work" ? "Focus session" : "Break"}</p>
        <p className={`font-bold tabular-nums ${compact ? "text-3xl" : "text-5xl"}`} role="timer" aria-live="off">
          {formatDuration(timer.remainingMs)}
        </p>
        <div className="mx-auto mt-2 h-1.5 w-full max-w-56 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
          <div className="h-full bg-secondary" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <p className="sr-only" aria-live="polite">
          {timer.runState === "paused" ? "Paused" : ""}
        </p>
      </div>

      {idle && timer.phase === "work" ? (
        <div className="flex flex-wrap items-end justify-center gap-2">
          <button
            type="button"
            className="mc-btn mc-btn-secondary mc-btn-sm"
            onClick={() => {
              setCustomMinutes(String(preferences.workMinutes));
              timer.setDurationMinutes(preferences.workMinutes);
            }}
          >
            Pomodoro {preferences.workMinutes}/{preferences.breakMinutes}
          </button>
          <div className="flex items-end gap-1">
            <label className="text-sm">
              <span className="block font-semibold">Minutes</span>
              <input
                type="number"
                min={1}
                max={180}
                className="mc-input w-20 min-h-9 py-1"
                value={customMinutes}
                onChange={(event) => {
                  setCustomMinutes(event.target.value);
                  const minutes = Number(event.target.value);
                  if (minutes >= 1) timer.setDurationMinutes(minutes);
                }}
              />
            </label>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        {idle ? (
          <button type="button" className="mc-btn mc-btn-primary" onClick={timer.start}>
            <Play size={16} aria-hidden="true" /> Start
          </button>
        ) : null}
        {timer.runState === "running" ? (
          <button type="button" className="mc-btn mc-btn-primary" onClick={timer.pause}>
            <Pause size={16} aria-hidden="true" /> Pause
          </button>
        ) : null}
        {timer.runState === "paused" ? (
          <button type="button" className="mc-btn mc-btn-primary" onClick={timer.resume}>
            <Play size={16} aria-hidden="true" /> Resume
          </button>
        ) : null}
        {!idle ? (
          <>
            <button type="button" className="mc-btn mc-btn-secondary" onClick={timer.reset}>
              <RotateCcw size={16} aria-hidden="true" /> Reset
            </button>
            <button type="button" className="mc-btn mc-btn-ghost" onClick={timer.end}>
              <Square size={16} aria-hidden="true" /> End
            </button>
          </>
        ) : null}
      </div>

      {timer.runState === "finished" ? (
        <div className="rounded-xl bg-surface-muted p-3 text-center" role="status">
          <p className="font-semibold">{timer.phase === "work" ? "Session finished." : "Break finished."}</p>
          <p className="mc-hint">Your task stays as it is until you change it.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {timer.phase === "work" && timer.includeBreak ? (
              <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={timer.startBreak}>
                <Coffee size={16} aria-hidden="true" /> Take a {preferences.breakMinutes}-minute break
              </button>
            ) : null}
            <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={timer.end}>
              Done
            </button>
          </div>
        </div>
      ) : null}

      {!compact ? (
        <label className="flex items-center justify-center gap-2 text-sm">
          <input type="checkbox" className="h-5 w-5" checked={timer.includeBreak} onChange={(event) => timer.setIncludeBreak(event.target.checked)} />
          Offer a break afterwards
        </label>
      ) : null}
    </div>
  );
}
