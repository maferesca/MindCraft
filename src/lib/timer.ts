import type { TimerSession } from "./preferences";

// Timer maths. Time comes from timestamps rather than counted ticks, so
// background tabs and page refreshes cannot slow a running session.

export function elapsedMs(session: TimerSession, now: number) {
  const running = session.runState === "running" && session.startedAt !== null ? Math.max(0, now - session.startedAt) : 0;
  return session.accumulatedMs + running;
}

export function isCountdown(session: TimerSession) {
  return session.phase === "break" || session.mode === "countdown";
}

export function remainingMs(session: TimerSession, now: number) {
  return Math.max(0, session.targetMs - elapsedMs(session, now));
}

export function hasExpired(session: TimerSession, now: number) {
  return session.runState === "running" && isCountdown(session) && remainingMs(session, now) === 0;
}

export function start(session: TimerSession, now: number, targetMs: number, phase: TimerSession["phase"] = "work"): TimerSession {
  return { ...session, phase, runState: "running", startedAt: now, accumulatedMs: 0, targetMs, endedBy: null };
}

export function pause(session: TimerSession, now: number): TimerSession {
  return { ...session, runState: "paused", startedAt: null, accumulatedMs: elapsedMs(session, now) };
}

export function resume(session: TimerSession, now: number): TimerSession {
  return { ...session, runState: "running", startedAt: now };
}

export function finish(session: TimerSession, now: number, endedBy: "user" | "zero"): TimerSession {
  const elapsed = elapsedMs(session, now);
  const accumulatedMs = endedBy === "zero" ? session.targetMs : isCountdown(session) ? Math.min(elapsed, session.targetMs) : elapsed;
  return { ...session, runState: "finished", startedAt: null, accumulatedMs, endedBy };
}

export function reset(session: TimerSession): TimerSession {
  return { ...session, phase: "work", runState: "idle", startedAt: null, accumulatedMs: 0, targetMs: 0, endedBy: null };
}

export function formatClock(ms: number, roundUp = false) {
  const totalSeconds = roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
