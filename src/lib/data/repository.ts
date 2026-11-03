import type { Streak } from "../types";

// A small, table-shaped data API. The Supabase implementation talks to
// Postgres (protected by RLS); the demo implementation keeps fictional data
// in this browser's localStorage so the app can be explored without an account.

export type TableName =
  | "profiles"
  | "preferences"
  | "notification_preferences"
  | "workspaces"
  | "workspace_blocks"
  | "tasks"
  | "task_steps"
  | "notes"
  | "calendar_events"
  | "conversations"
  | "messages";

// Tables with one row per user are keyed by user_id instead of id.
export const USER_KEYED_TABLES: TableName[] = ["profiles", "preferences", "notification_preferences"];

export type Row = Record<string, unknown>;

export interface Repository {
  mode: "supabase" | "demo";
  userId: string;
  email: string | null;
  list<T>(table: TableName): Promise<T[]>;
  insert<T>(table: TableName, row: Row): Promise<T>;
  update<T>(table: TableName, key: string, patch: Row): Promise<T>;
  remove(table: TableName, key: string): Promise<void>;
  removeWhere(table: TableName, column: string, value: string): Promise<void>;
  getStreak(): Promise<Streak | null>;
  recordVisit(timezone: string): Promise<Streak | null>;
  signOut(): Promise<void>;
}

export function keyColumn(table: TableName) {
  return USER_KEYED_TABLES.includes(table) ? "user_id" : "id";
}
