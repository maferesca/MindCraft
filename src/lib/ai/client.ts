"use client";

import type { AssistantContext, AssistantResult } from "../schemas";
import { assistantResultSchema } from "../schemas";

export type AiCallResult<T> = { ok: true; data: T } | { ok: false; code: string; message: string };

// The server stops at its provider timeouts. This also bounds a stalled connection.
const REQUEST_TIMEOUT_MS = 45_000;

const OFFLINE = { ok: false as const, code: "offline", message: "You're offline. Your text is kept here; try again when you're connected." };

async function readError(response: Response) {
  try {
    const body = await response.json();
    return { code: body?.error?.code ?? "error", message: body?.error?.message ?? "The assistant could not answer right now." };
  } catch {
    return { code: "error", message: "The assistant could not answer right now." };
  }
}

export async function askAssistant(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  context: AssistantContext,
): Promise<AiCallResult<AssistantResult>> {
  if (!navigator.onLine) return OFFLINE;
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: messages.slice(-12), context }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return { ok: false, ...(await readError(response)) };
    // Validate again in the browser: never trust a response shape blindly.
    const parsed = assistantResultSchema.safeParse(await response.json());
    if (!parsed.success) return { ok: false, code: "invalid_output", message: "The assistant's answer could not be read." };
    return { ok: true, data: parsed.data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      return { ok: false, code: "timeout", message: "The assistant took too long. Your text is kept here." };
    }
    return { ok: false, code: "network", message: "The assistant could not be reached. Your text is kept here." };
  }
}

export async function transcribeRecording(audio: Blob): Promise<AiCallResult<string>> {
  if (!navigator.onLine) return OFFLINE;
  const form = new FormData();
  form.append("audio", audio, "recording");
  try {
    const response = await fetch("/api/transcribe", { method: "POST", body: form });
    if (!response.ok) return { ok: false, ...(await readError(response)) };
    const body = await response.json();
    return { ok: true, data: typeof body.transcript === "string" ? body.transcript : "" };
  } catch {
    return { ok: false, code: "network", message: "The recording could not be sent. You can type instead." };
  }
}

// Detects choices the user has stated, so the assistant can respect them.
const DECLINE_PATTERNS: Array<[NonNullable<AssistantContext["declined"]>[number], RegExp]> = [
  ["timer", /\b(no|don'?t|do not|without|stop|skip)\b[^.!?]{0,30}\btimers?\b|\btimers? (don'?t|do not) (help|work)/i],
  ["breaks", /\b(no|don'?t|do not|without|skip)\b[^.!?]{0,30}\bbreaks?\b/i],
  ["planning", /\b(no|don'?t|do not|without|skip)\b[^.!?]{0,30}\b(plan|planning)\b/i],
  // Spanish. Some words end in an accented letter, which \b does not treat as a word character.
  ["timer", /\b(no|sin|nada de|evita|quita|omite)\b[^.!?]{0,30}\b(temporizador(es)?|cron[oó]metros?)(?![a-záéíóúñ])/i],
  ["breaks", /\b(no|sin|nada de|evita|quita|omite)\b[^.!?]{0,30}\b(pausas?|descansos?)(?![a-záéíóúñ])/i],
  ["planning", /\b(no|sin|nada de|evita|quita|omite)\b[^.!?]{0,30}\b(planes|plan|planificar|planear|planificaci[oó]n)(?![a-záéíóúñ])/i],
];

export function detectDeclines(userMessages: string[]): NonNullable<AssistantContext["declined"]> {
  const found = new Set<NonNullable<AssistantContext["declined"]>[number]>();
  for (const message of userMessages) {
    for (const [kind, pattern] of DECLINE_PATTERNS) if (pattern.test(message)) found.add(kind);
  }
  return [...found];
}
