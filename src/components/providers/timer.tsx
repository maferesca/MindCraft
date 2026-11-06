"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { Preferences, TimerSession } from "@/lib/preferences";
import * as timer from "@/lib/timer";
import { useNotify } from "../ui/notifications";
import { useWorkspaceData } from "./workspace-data";

// The session that exists without a timer block, used by Focus Mode.
const DEFAULT_TIMER_ID = "default";

export interface TimerControls {
  id: string;
  name: string;
  session: TimerSession;
  // What the clock shows: time left on a countdown, time passed on a stopwatch.
  displayMs: number;
  elapsedMs: number;
  durationMs: number;
  setMode: (mode: TimerSession["mode"]) => void;
  setDurationMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
  setTaskId: (taskId: string | null) => void;
  // Always a full session at the configured length. Replacing an unfinished one
  // needs the person's confirmation, which the timer block asks for.
  startNewSession: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;
  startBreak: () => void;
  // Runs one countdown of this length without changing the configured length.
  startShortSession: (minutes: number, taskId: string) => void;
}

interface TimerContextValue {
  now: number;
  controlsFor: (id: string) => TimerControls;
  shownTimerId: string;
}

const TimerContext = createContext<TimerContextValue | null>(null);

function sessionOf(preferences: Preferences, id: string): TimerSession {
  if (id === DEFAULT_TIMER_ID) return preferences.timer;
  return preferences.timerSessions[id] ?? { ...preferences.timer, mode: "countdown", phase: "work", runState: "idle", startedAt: null, accumulatedMs: 0, targetMs: 0, endedBy: null, taskId: null };
}

function withSession(patch: Partial<Preferences>, preferences: Preferences, id: string, session: TimerSession): Partial<Preferences> {
  if (id === DEFAULT_TIMER_ID) return { ...patch, timer: session };
  return { ...patch, timerSessions: { ...preferences.timerSessions, ...patch.timerSessions, [id]: session } };
}

function runningTimerId(preferences: Preferences) {
  if (preferences.timer.runState === "running") return DEFAULT_TIMER_ID;
  return Object.keys(preferences.timerSessions).find((id) => preferences.timerSessions[id].runState === "running") ?? null;
}

// Every timer keeps its own session, saved with preferences, so a refresh or a
// change of view never resets it. Time comes from timestamps, so background tabs
// stay accurate. Nothing starts by itself, and no timer ever changes a task.
export function TimerProvider({ children }: { children: ReactNode }) {
  const { preferences, updatePreferences, encourage, trackFocusSession, blocks, updateBlockConfig } = useWorkspaceData();
  const { announce, notify } = useNotify();
  const [now, setNow] = useState(() => Date.now());
  const [loadedAt] = useState(() => Date.now());
  const runningId = runningTimerId(preferences);
  const running = runningId ? sessionOf(preferences, runningId) : null;

  const blockFor = useCallback((id: string) => blocks.find((block) => block.id === id), [blocks]);
  const nameOf = useCallback((id: string) => blockFor(id)?.title || "Focus timer", [blockFor]);

  const playChime = useCallback(() => {
    if (!preferences.sounds) return;
    try {
      const context = new AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 523;
      gain.gain.setValueAtTime(0.08, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.8);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.8);
    } catch {
      // Audio not available.
    }
  }, [preferences.sounds]);

  // The session status always shows. The encouraging line needs a confirmed save.
  const saveFinished = useCallback(
    async (id: string, finished: TimerSession, canEncourage = true) => {
      const saved = await updatePreferences(withSession({}, preferences, id, finished));
      if (saved && finished.phase === "work") trackFocusSession("finish");
      if (saved && canEncourage && finished.phase === "work") encourage("session");
    },
    [preferences, updatePreferences, encourage, trackFocusSession],
  );

  useEffect(() => {
    if (!runningId || !running) return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (!timer.hasExpired(running, current)) return;
      playChime();
      announce(running.phase === "work" ? "Session finished." : "Break finished.");
      // A session that ended while the page was closed finished quietly earlier.
      const endedAt = (running.startedAt ?? current) + running.targetMs - running.accumulatedMs;
      saveFinished(runningId, timer.finish(running, current, "zero"), endedAt >= loadedAt);
    };
    tick();
    const interval = window.setInterval(tick, 500);
    // Timers are throttled in background tabs, so catch up on return.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [runningId, running, loadedAt, announce, playChime, saveFinished]);

  // A removed timer block takes its session with it.
  useEffect(() => {
    const stale = Object.keys(preferences.timerSessions).filter((id) => !blockFor(id));
    if (!stale.length) return;
    const timerSessions = { ...preferences.timerSessions };
    for (const id of stale) delete timerSessions[id];
    updatePreferences({ timerSessions, activeTimerId: stale.includes(preferences.activeTimerId ?? "") ? null : preferences.activeTimerId });
  }, [preferences.timerSessions, preferences.activeTimerId, blockFor, updatePreferences]);

  // Only one timer runs at a time, so starting one pauses any other first.
  const run = useCallback(
    (id: string, build: (session: TimerSession, current: number) => TimerSession) => {
      const current = Date.now();
      setNow(current);
      const other = runningId && runningId !== id ? runningId : null;
      const paused = other ? withSession({}, preferences, other, timer.pause(sessionOf(preferences, other), current)) : {};
      updatePreferences({ ...withSession(paused, preferences, id, build(sessionOf(preferences, id), current)), activeTimerId: id === DEFAULT_TIMER_ID ? null : id });
      if (other) notify(`${nameOf(other)} paused. Only one timer runs at a time.`);
    },
    [runningId, preferences, updatePreferences, notify, nameOf],
  );

  function controlsFor(id: string): TimerControls {
    const session = sessionOf(preferences, id);
    const block = blockFor(id);
    const minutes = typeof block?.config.minutes === "number" ? block.config.minutes : preferences.workMinutes;
    const durationMs = minutes * 60_000;
    const idle = session.runState === "idle";
    const save = (next: TimerSession) => updatePreferences(withSession({}, preferences, id, next));
    const elapsed = timer.elapsedMs(session, now);

    return {
      id,
      name: nameOf(id),
      session,
      displayMs: timer.isCountdown(session) ? (idle ? durationMs : timer.remainingMs(session, now)) : elapsed,
      elapsedMs: elapsed,
      durationMs,
      // Mode and duration can only change between sessions.
      setMode: (mode) => {
        if (idle) save({ ...session, mode });
      },
      setDurationMinutes: (value) => {
        if (!idle || value < 1) return;
        const rounded = Math.min(600, Math.round(value));
        if (block) updateBlockConfig(id, { minutes: rounded });
        else updatePreferences({ workMinutes: rounded });
      },
      setBreakMinutes: (value) => {
        if (value >= 1) updatePreferences({ breakMinutes: Math.min(120, Math.round(value)) });
      },
      setTaskId: (taskId) => {
        if (block) updateBlockConfig(id, { taskId });
        else save({ ...session, taskId });
      },
      startNewSession: () => {
        run(id, (current, time) => timer.start({ ...current, phase: "work" }, time, current.mode === "countdown" ? durationMs : 0));
        trackFocusSession("begin");
        announce("Session started.");
      },
      pause: () => {
        const current = Date.now();
        setNow(current);
        save(timer.pause(session, current));
        announce("Timer paused.");
      },
      resume: () => {
        run(id, (current, time) => timer.resume(current, time));
        announce("Timer resumed.");
      },
      finish: () => {
        const current = Date.now();
        setNow(current);
        saveFinished(id, timer.finish(session, current, "user"));
        announce("Session finished.");
      },
      reset: () => save(timer.reset(session)),
      startBreak: () => {
        run(id, (current, time) => timer.start(current, time, preferences.breakMinutes * 60_000, "break"));
        announce("Break started.");
      },
      startShortSession: (value, taskId) => {
        run(id, (current, time) => timer.start({ ...current, mode: "countdown", taskId }, time, value * 60_000));
        trackFocusSession("begin");
        announce("Session started.");
      },
    };
  }

  // Focus Mode shows the timer in use, so opening it never touches a session.
  const shownTimerId = runningId ?? (preferences.activeTimerId && blockFor(preferences.activeTimerId) ? preferences.activeTimerId : DEFAULT_TIMER_ID);

  return <TimerContext.Provider value={{ now, controlsFor, shownTimerId }}>{children}</TimerContext.Provider>;
}

// With an id, the controls of that timer block. Without one, the timer in use.
export function useTimer(id?: string) {
  const value = useContext(TimerContext);
  if (!value) throw new Error("useTimer must be used inside TimerProvider");
  return value.controlsFor(id ?? value.shownTimerId);
}
