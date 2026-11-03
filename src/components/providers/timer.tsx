"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useNotify } from "../ui/notifications";
import { useWorkspaceData } from "./workspace-data";

type Phase = "work" | "break";
type RunState = "idle" | "running" | "paused" | "finished";

interface TimerState {
  // Minutes chosen in the Timer block; null means "use the preference".
  customMinutes: number | null;
  phase: Phase;
  runState: RunState;
  durationMs: number;
  remainingMs: number;
  includeBreak: boolean;
}

interface TimerContextValue extends TimerState {
  setDurationMinutes: (minutes: number) => void;
  setIncludeBreak: (value: boolean) => void;
  start: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  end: () => void;
  startBreak: () => void;
}

const TimerContext = createContext<TimerContextValue | null>(null);

// One shared timer so the Timer block and Focus Mode show the same session.
// It never starts by itself, and finishing a session never completes a task.
export function TimerProvider({ children }: { children: ReactNode }) {
  const { preferences } = useWorkspaceData();
  const { announce } = useNotify();
  const [state, setState] = useState<TimerState>(() => ({
    customMinutes: null,
    phase: "work",
    runState: "idle",
    durationMs: preferences.workMinutes * 60_000,
    remainingMs: preferences.workMinutes * 60_000,
    includeBreak: true,
  }));
  const endsAtRef = useRef<number | null>(null);

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
    if (state.runState !== "running") return;
    const interval = window.setInterval(() => {
      const remaining = Math.max(0, (endsAtRef.current ?? Date.now()) - Date.now());
      if (remaining > 0) {
        setState((current) => ({ ...current, remainingMs: remaining }));
        return;
      }
      endsAtRef.current = null;
      playChime();
      announce(
        state.phase === "work" ? "Focus session finished. Your task stays as it is until you change it." : "Break finished.",
      );
      setState((current) => ({ ...current, remainingMs: 0, runState: "finished" }));
    }, 500);
    return () => window.clearInterval(interval);
  }, [state.runState, state.phase, announce, playChime]);

  // While idle, the session length follows preferences unless the user picked a custom length.
  const idleWorkMs = (state.customMinutes ?? preferences.workMinutes) * 60_000;
  const current = state.runState === "idle" && state.phase === "work" ? { ...state, durationMs: idleWorkMs, remainingMs: idleWorkMs } : state;

  const value: TimerContextValue = {
    ...current,
    setDurationMinutes: (minutes) => {
      const customMinutes = Math.min(180, Math.max(1, Math.round(minutes)));
      setState((previous) => (previous.runState === "idle" ? { ...previous, customMinutes } : previous));
    },
    setIncludeBreak: (includeBreak) => setState((current) => ({ ...current, includeBreak })),
    start: () => {
      endsAtRef.current = Date.now() + current.durationMs;
      setState((previous) => ({ ...previous, runState: "running", durationMs: current.durationMs, remainingMs: current.durationMs }));
      announce(state.phase === "work" ? "Focus session started." : "Break started.");
    },
    pause: () => {
      setState((current) => ({ ...current, runState: "paused", remainingMs: Math.max(0, (endsAtRef.current ?? Date.now()) - Date.now()) }));
      endsAtRef.current = null;
      announce("Timer paused.");
    },
    resume: () => {
      endsAtRef.current = Date.now() + state.remainingMs;
      setState((current) => ({ ...current, runState: "running" }));
      announce("Timer resumed.");
    },
    reset: () => {
      endsAtRef.current = null;
      setState((current) => ({ ...current, runState: "idle", remainingMs: current.durationMs }));
    },
    end: () => {
      endsAtRef.current = null;
      const workMs = preferences.workMinutes * 60_000;
      setState((previous) => ({ ...previous, phase: "work", runState: "idle", durationMs: workMs, remainingMs: workMs }));
      announce("Timer ended.");
    },
    startBreak: () => {
      const breakMs = preferences.breakMinutes * 60_000;
      endsAtRef.current = Date.now() + breakMs;
      setState((current) => ({ ...current, phase: "break", runState: "running", durationMs: breakMs, remainingMs: breakMs }));
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

export function formatDuration(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
