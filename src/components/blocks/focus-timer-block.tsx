"use client";

import { Coffee, Flag, Pause, Play, RotateCcw } from "lucide-react";
import { formatClock } from "@/lib/timer";
import { openTasks } from "@/lib/task-helpers";
import { useTimer } from "../providers/timer";
import { useWorkspaceData } from "../providers/workspace-data";
import { ChoiceGroup } from "../ui/choice-group";

// Countdown or stopwatch. It starts only when pressed and never changes a task.
export function FocusTimerBlock({ compact = false }: { compact?: boolean }) {
  const timer = useTimer();
  const { tasks, preferences, updatePreferences } = useWorkspaceData();
  const { session } = timer;
  const idle = session.runState === "idle";
  const finished = session.runState === "finished";
  const isBreak = session.phase === "break";
  const countdown = isBreak || session.mode === "countdown";
  const reachedZero = finished && session.endedBy === "zero";
  const taskChoices = openTasks(tasks);
  const linkedTask = tasks.find((task) => task.id === session.taskId);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex justify-center">
        <ChoiceGroup label="Timer mode" value={session.mode} disabled={!idle} options={[["countdown", "Countdown"], ["stopwatch", "Stopwatch"]]} onChange={timer.setMode} />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-text-muted">{isBreak ? "Break" : "Focus session"}</p>
        <p className={`font-bold tabular-nums ${compact ? "text-3xl" : "text-5xl"}`} role="timer" aria-live="off">
          {formatClock(finished && !reachedZero ? timer.elapsedMs : timer.displayMs, countdown)}
        </p>
        {!idle && !finished && session.runState === "paused" ? <p className="mc-hint">Paused</p> : null}
      </div>

      {finished ? (
        <div className="rounded-xl bg-surface-muted p-3 text-center" role="status">
          <p className="font-semibold">{isBreak ? "Break finished" : "Session finished"}</p>
          {reachedZero ? null : <p className="mc-hint">Time spent: {formatClock(timer.elapsedMs)}</p>}
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {!isBreak ? (
              <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={timer.startBreak}>
                <Coffee size={16} aria-hidden="true" /> Start break
              </button>
            ) : null}
            <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={timer.start}>
              <Play size={16} aria-hidden="true" /> Start another session
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap justify-center gap-2">
        {idle ? (
          <button type="button" className="mc-btn mc-btn-primary" onClick={timer.start}>
            <Play size={16} aria-hidden="true" /> Start
          </button>
        ) : null}
        {session.runState === "running" ? (
          <button type="button" className="mc-btn mc-btn-primary" onClick={timer.pause}>
            <Pause size={16} aria-hidden="true" /> Pause
          </button>
        ) : null}
        {session.runState === "paused" ? (
          <button type="button" className="mc-btn mc-btn-primary" onClick={timer.resume}>
            <Play size={16} aria-hidden="true" /> Resume
          </button>
        ) : null}
        {session.runState === "running" || session.runState === "paused" ? (
          <button type="button" className="mc-btn mc-btn-secondary" onClick={timer.finish}>
            <Flag size={16} aria-hidden="true" /> Finish
          </button>
        ) : null}
        {!idle ? (
          <button type="button" className="mc-btn mc-btn-ghost" onClick={timer.reset}>
            <RotateCcw size={16} aria-hidden="true" /> Reset
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end justify-center gap-3 text-sm">
        {session.mode === "countdown" ? (
          <label>
            <span className="block font-semibold">Minutes</span>
            <input
              key={preferences.workMinutes}
              type="number"
              min={1}
              max={600}
              disabled={!idle}
              className="mc-input min-h-9 w-20 py-1"
              defaultValue={preferences.workMinutes}
              onBlur={(event) => {
                const minutes = Number(event.target.value);
                if (minutes >= 1) timer.setDurationMinutes(minutes);
                else event.target.value = String(preferences.workMinutes);
              }}
            />
          </label>
        ) : null}
        <label>
          <span className="block font-semibold">Break minutes</span>
          <input
            key={preferences.breakMinutes}
            type="number"
            min={1}
            max={120}
            className="mc-input min-h-9 w-20 py-1"
            defaultValue={preferences.breakMinutes}
            onBlur={(event) => {
              const minutes = Number(event.target.value);
              if (minutes >= 1) timer.setBreakMinutes(minutes);
              else event.target.value = String(preferences.breakMinutes);
            }}
          />
        </label>
        <label className="flex min-h-9 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={preferences.sounds} onChange={(event) => updatePreferences({ sounds: event.target.checked })} />
          Sound
        </label>
      </div>

      {compact ? null : (
        <div>
          <label htmlFor="timer-task" className="mc-label text-sm">
            Task <span className="mc-hint font-normal">(optional)</span>
          </label>
          <select id="timer-task" className="mc-input min-h-9 py-1" value={session.taskId ?? ""} onChange={(event) => timer.setTaskId(event.target.value || null)}>
            <option value="">No task</option>
            {taskChoices.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
            {linkedTask && linkedTask.status === "done" ? <option value={linkedTask.id}>{linkedTask.title} (done)</option> : null}
          </select>
        </div>
      )}
    </div>
  );
}
