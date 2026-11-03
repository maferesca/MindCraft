"use client";

import { browserTimezone, localDateString, nextStreak } from "../dates";
import { buildSampleData } from "../demo/sample-data";
import type { Streak } from "../types";
import { DEMO_COOKIE } from "../supabase/config";
import { keyColumn, type Repository, type Row, type TableName } from "./repository";

const STORAGE_KEY = "mindcraft-demo-v1";
const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";

interface DemoDatabase {
  tables: Partial<Record<TableName, Row[]>>;
  streak: Streak | null;
}

function load(): DemoDatabase {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as DemoDatabase;
  } catch {
    // Storage blocked or corrupted: start fresh.
  }
  return { tables: {}, streak: null };
}

function save(database: DemoDatabase) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  } catch {
    // Quota or privacy mode: the session keeps working in memory.
  }
}

export function startDemo(withSampleData: boolean) {
  const now = new Date().toISOString();
  const base = { user_id: DEMO_USER_ID, created_at: now, updated_at: now };
  const database: DemoDatabase = {
    tables: {
      profiles: [{ ...base, display_name: null, timezone: browserTimezone(), onboarding_completed: false }],
      preferences: [{ ...base, settings: {} }],
      notification_preferences: [
        { ...base, style: "off", quiet_hours_start: null, quiet_hours_end: null, preferred_time: null, inactivity_days: 2, snoozed_until: null },
      ],
      workspaces: [{ ...base, id: crypto.randomUUID(), name: "My workspace" }],
      workspace_blocks: [],
      conversations: [],
      messages: [],
    },
    streak: null,
  };
  if (withSampleData) {
    Object.assign(database.tables, buildSampleData(DEMO_USER_ID, localDateString(browserTimezone())));
  }
  save(database);
  document.cookie = `${DEMO_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function endDemo() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  document.cookie = `${DEMO_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function createLocalRepository(): Repository | null {
  const database = load();
  if (!database.tables.profiles?.length) return null;

  const rows = (table: TableName) => (database.tables[table] ??= []);

  return {
    mode: "demo",
    userId: DEMO_USER_ID,
    email: null,

    async list<T>(table: TableName) {
      return structuredClone(rows(table)) as T[];
    },

    async insert<T>(table: TableName, row: Row) {
      const now = new Date().toISOString();
      const record = { id: crypto.randomUUID(), created_at: now, updated_at: now, ...row, user_id: DEMO_USER_ID };
      rows(table).push(record);
      save(database);
      return structuredClone(record) as T;
    },

    async update<T>(table: TableName, key: string, patch: Row) {
      const column = keyColumn(table);
      const record = rows(table).find((item) => item[column] === key);
      if (!record) throw new Error(`Could not update ${table}: record not found`);
      Object.assign(record, patch, { updated_at: new Date().toISOString() });
      save(database);
      return structuredClone(record) as T;
    },

    async remove(table: TableName, key: string) {
      const column = keyColumn(table);
      database.tables[table] = rows(table).filter((item) => item[column] !== key);
      // Mirror the database's cascade and set-null rules.
      if (table === "tasks") {
        database.tables.task_steps = rows("task_steps").filter((step) => step.task_id !== key);
        for (const note of rows("notes")) if (note.task_id === key) note.task_id = null;
        for (const event of rows("calendar_events")) if (event.task_id === key) event.task_id = null;
      }
      if (table === "conversations") {
        database.tables.messages = rows("messages").filter((message) => message.conversation_id !== key);
      }
      save(database);
    },

    async removeWhere(table: TableName, column: string, value: string) {
      database.tables[table] = rows(table).filter((item) => item[column] !== value);
      save(database);
    },

    async getStreak() {
      return database.streak;
    },

    async recordVisit(timezone: string) {
      database.streak = nextStreak(database.streak, localDateString(timezone));
      save(database);
      return database.streak;
    },

    async signOut() {
      endDemo();
    },
  };
}
