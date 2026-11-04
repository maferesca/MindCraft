"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { TimerSession } from "@/lib/preferences";
import * as timer from "@/lib/timer";
import { useNotify } from "../ui/notifications";
import { useWorkspaceData } from "./workspace-data";

interface TimerContextValue {
  session: TimerSession;
  // What the clock shows: time left on a countdown, time passed on a stopwatch.
  displayMs: number;
  elapsedMs: number;
  durationMs: number;
  setMode: (mode: TimerSession["mode"]) => void;
  setDurationMinutes: (minutes: number) => void;
  setBreakMinutes: (minutes: number) => void;
  setTaskId: (taskId: string | null) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  finish: () => void;
  reset: () => void;
  startBreak: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

// One shared session for every Focus timer block and Focus Mode. It is saved with
// preferences on each change of state, so it survives a refresh. It never starts by
// itself, and it never changes a task.
export function TimerProvider({ children }: { children: ReactNode }) {
  const { preferences, updatePreferences } = useWorkspaceData();
  const { announce } = useNotify();
  const session = preferences.timer;
  const [now, setNow] = useState(() => Date.now());

  const save = useCallback((next: TimerSession) => updatePreferences({ timer: next }), [updatePreferences]);

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

  useEffect(() => {
    if (session.runState !== "running") return;
    const tick = () => {
      const current = Date.now();
      setNow(current);
      if (!timer.hasExpired(session, current)) return;
      playChime();
      announce(session.phase === "work" ? "Session finished." : "Break finished.");
      save(timer.finish(session, current, "zero"));
    };
    tick();
    const interval = window.setInterval(tick, 500);
    // Timers are throttled in background tabs, so catch up on return.
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [session, announce, playChime, save]);

  const durationMs = preferences.workMinutes * 60_000;
  const idle = session.runState === "idle";
  const elapsed = timer.elapsedMs(session, now);
  const displayMs = timer.isCountdown(session) ? (idle ? durationMs : timer.remainingMs(session, now)) : elapsed;

  const value: TimerContextValue = {
    session,
    displayMs,
    elapsedMs: elapsed,
    durationMs,
    // Mode and duration can only change between sessions.
    setMode: (mode) => {
      if (idle) save({ ...session, mode });
    },
    setDurationMinutes: (minutes) => {
      if (idle && minutes >= 1) updatePreferences({ workMinutes: Math.min(600, Math.round(minutes)) });
    },
    setBreakMinutes: (minutes) => {
      if (minutes >= 1) updatePreferences({ breakMinutes: Math.min(120, Math.round(minutes)) });
    },
    setTaskId: (taskId) => save({ ...session, taskId }),
    start: () => {
      const current = Date.now();
      setNow(current);
      save(timer.start(session, current, session.mode === "countdown" ? durationMs : 0));
      announce("Session started.");
    },
    pause: () => {
      const current = Date.now();
      setNow(current);
      save(timer.pause(session, current));
      announce("Timer paused.");
    },
    resume: () => {
      const current = Date.now();
      setNow(current);
      save(timer.resume(session, current));
      announce("Timer resumed.");
    },
    finish: () => {
      const current = Date.now();
      setNow(current);
      save(timer.finish(session, current, "user"));
      announce("Session finished.");
    },
    reset: () => save(timer.reset(session)),
    startBreak: () => {
      const current = Date.now();
      setNow(current);
      save(timer.start(session, current, preferences.breakMinutes * 60_000, "break"));
      announce("Break started.");
    },
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const value = useContext(TimerContext);
  if (!value) throw new Error("useTimer must be used inside TimerProvider");
  return value;
}
