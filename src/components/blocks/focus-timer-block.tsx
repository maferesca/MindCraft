"use client";

import { Coffee, Flag, Pause, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import { formatClock } from "@/lib/timer";
import { openTasks, taskBlocks, tasksForBlock } from "@/lib/task-helpers";
import type { WorkspaceBlock } from "@/lib/types";
import { useTimer } from "../providers/timer";
import { useWorkspaceData } from "../providers/workspace-data";
import { ChoiceGroup } from "../ui/choice-group";
import { useBlockConfig } from "./use-block-config";

// Countdown or stopwatch. It starts only when pressed and never changes a task.
// A timer block has its own length, name, and link. Focus Mode shows the timer in use.
export function FocusTimerBlock({ block, compact = false }: { block?: WorkspaceBlock; compact?: boolean }) {
  const timer = useTimer(block?.id);
  const { preferences, updatePreferences } = useWorkspaceData();
  const { session } = timer;
  const [confirming, setConfirming] = useState(false);
  const idle = session.runState === "idle";
  const finished = session.runState === "finished";
  const unfinished = session.runState === "running" || session.runState === "paused";
  const isBreak = session.phase === "break";
  const countdown = isBreak || session.mode === "countdown";
  const reachedZero = finished && session.endedBy === "zero";
  const unsaved = block?.id.startsWith("new-") ?? false;
  const minutes = Math.round(timer.durationMs / 60_000);

  function startNew() {
    if (unfinished) setConfirming(true);
    else timer.startNewSession();
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex justify-center">
        <ChoiceGroup label="Timer mode" value={session.mode} disabled={!idle} options={[["countdown", "Countdown"], ["stopwatch", "Stopwatch"]]} onChange={timer.setMode} />
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-text-muted">{compact ? `${timer.name}: ` : ""}{isBreak ? "Break" : "Focus session"}</p>
        <p className={`font-bold tabular-nums ${compact ? "text-3xl" : "text-5xl"}`} role="timer" aria-live="off">
          {formatClock(finished && !reachedZero ? timer.elapsedMs : timer.displayMs, countdown)}
        </p>
        {session.runState === "paused" ? <p className="mc-hint">Paused</p> : null}
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
            <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={timer.startNewSession}>
              <Play size={16} aria-hidden="true" /> Start another session
            </button>
          </div>
        </div>
      ) : null}

      {confirming ? (
        <div className="rounded-xl border-2 border-border-strong p-3 text-center" role="alertdialog" aria-label="Replace the current session?">
          <p className="font-semibold">This session isn&apos;t finished.</p>
          <p className="mc-hint">Starting a new one replaces it.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="mc-btn mc-btn-primary mc-btn-sm"
              onClick={() => {
                setConfirming(false);
                timer.startNewSession();
              }}
            >
              Start new session
            </button>
            <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => setConfirming(false)}>
              Keep current session
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {idle ? (
            <button type="button" className="mc-btn mc-btn-primary" disabled={unsaved} onClick={startNew}>
              <Play size={16} aria-hidden="true" /> Start new session
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
          {unfinished ? (
            <button type="button" className="mc-btn mc-btn-secondary" onClick={timer.finish}>
              <Flag size={16} aria-hidden="true" /> Finish
            </button>
          ) : null}
          {!idle ? (
            <button type="button" className="mc-btn mc-btn-ghost" onClick={timer.reset}>
              <RotateCcw size={16} aria-hidden="true" /> Reset
            </button>
          ) : null}
          {unfinished ? (
            <button type="button" className="mc-btn mc-btn-ghost" onClick={startNew}>
              <Play size={16} aria-hidden="true" /> Start new session
            </button>
          ) : null}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-center gap-3 text-sm">
        {session.mode === "countdown" ? (
          <label>
            <span className="block font-semibold">Minutes</span>
            <input
              key={minutes}
              type="number"
              min={1}
              max={600}
              disabled={!idle}
              className="mc-input min-h-9 w-20 py-1"
              defaultValue={minutes}
              onBlur={(event) => {
                const value = Number(event.target.value);
                if (value >= 1) timer.setDurationMinutes(value);
                else event.target.value = String(minutes);
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
              const value = Number(event.target.value);
              if (value >= 1) timer.setBreakMinutes(value);
              else event.target.value = String(preferences.breakMinutes);
            }}
          />
        </label>
        <label className="flex min-h-9 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={preferences.sounds} onChange={(event) => updatePreferences({ sounds: event.target.checked })} />
          Sound
        </label>
      </div>

      {block && !compact ? <TimerLink block={block} /> : null}
    </div>
  );
}

// What this timer is for: a task, with the group's tasks first, or a short activity.
function TimerLink({ block }: { block: WorkspaceBlock }) {
  const { tasks, blocks } = useWorkspaceData();
  const [config, setConfig] = useBlockConfig(block, { taskId: "" as string | null, activity: "" });
  const members = block.group_id ? blocks.filter((item) => item.group_id === block.group_id) : [];
  const groupTasks = openTasks(taskBlocks(members).flatMap((item) => tasksForBlock(tasks, item.id, blocks)));
  const otherTasks = openTasks(tasks).filter((task) => !groupTasks.includes(task));
  const linked = tasks.find((task) => task.id === config.taskId);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div>
        <label htmlFor={`timer-task-${block.id}`} className="mc-label text-sm">
          Task <span className="mc-hint font-normal">(optional)</span>
        </label>
        <select id={`timer-task-${block.id}`} className="mc-input min-h-9 py-1" value={linked?.id ?? ""} onChange={(event) => setConfig({ taskId: event.target.value || null })}>
          <option value="">No task</option>
          {groupTasks.length ? (
            <optgroup label={block.group_title || "This group"}>
              {groupTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label={groupTasks.length ? "Other tasks" : "Tasks"}>
            {otherTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
            {linked && linked.status === "done" ? <option value={linked.id}>{linked.title} (done)</option> : null}
          </optgroup>
        </select>
      </div>
      {linked ? null : (
        <div>
          <label htmlFor={`timer-activity-${block.id}`} className="mc-label text-sm">
            Activity <span className="mc-hint font-normal">(optional)</span>
          </label>
          <input
            key={config.activity}
            id={`timer-activity-${block.id}`}
            className="mc-input min-h-9 py-1"
            maxLength={120}
            placeholder="Reading, stretching, review…"
            defaultValue={config.activity}
            onBlur={(event) => {
              if (event.target.value.trim() !== config.activity) setConfig({ activity: event.target.value.trim() });
            }}
          />
        </div>
      )}
    </div>
  );
}
