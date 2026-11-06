import type { Task } from "./types";

// Openers that describe activity without saying what will exist afterwards.
const VAGUE_TITLE = /^(work on|work|deal with|handle|look at|do|finish|stuff|trabajar( en)?|hacer|ver|revisar cosas|avanzar( en| con)?)\b/i;

export function isVagueTitle(title: string) {
  return VAGUE_TITLE.test(title.trim());
}

export function normalizeTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, " ");
}

// A deterministic id means that a double click, a retry, or another device
// reaches the same record, so the database rejects the second copy.
export async function proposalRecordId(key: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`mindcraft:${key}`));
  const hex = [...new Uint8Array(digest)].slice(0, 16).map((byte) => byte.toString(16).padStart(2, "0"));
  hex[6] = `5${hex[6][1]}`;
  hex[8] = `8${hex[8][1]}`;
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

// Lets "Plan [task title]" use that task's details without selecting it first.
export function findNamedTask(text: string, tasks: Array<Pick<Task, "id" | "title" | "status">>) {
  const message = normalizeTitle(text);
  const matches = tasks.filter((task) => task.status !== "done" && task.title.trim().length >= 4 && message.includes(normalizeTitle(task.title)));
  return matches.sort((a, b) => b.title.length - a.title.length)[0] ?? null;
}
