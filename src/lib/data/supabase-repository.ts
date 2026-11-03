"use client";

import { getBrowserSupabase } from "../supabase/client";
import type { Streak } from "../types";
import { keyColumn, type Repository, type Row, type TableName } from "./repository";

export async function createSupabaseRepository(): Promise<Repository | null> {
  const supabase = getBrowserSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return null;

  function fail(action: string, error: { message: string } | null): never {
    throw new Error(`Could not ${action}: ${error?.message ?? "unknown error"}`);
  }

  return {
    mode: "supabase",
    userId: user.id,
    email: user.email ?? null,

    async list<T>(table: TableName) {
      const query = supabase.from(table).select("*");
      const { data: rows, error } =
        table === "messages" ? await query.order("created_at", { ascending: true }).limit(200) : await query;
      if (error) fail(`load ${table}`, error);
      return (rows ?? []) as T[];
    },

    async insert<T>(table: TableName, row: Row) {
      const { data: inserted, error } = await supabase
        .from(table)
        .insert({ ...row, user_id: user.id })
        .select()
        .single();
      if (error) fail(`save to ${table}`, error);
      return inserted as T;
    },

    async update<T>(table: TableName, key: string, patch: Row) {
      const { data: updated, error } = await supabase
        .from(table)
        .update(patch)
        .eq(keyColumn(table), key)
        .select()
        .single();
      if (error) fail(`update ${table}`, error);
      return updated as T;
    },

    async remove(table: TableName, key: string) {
      const { error } = await supabase.from(table).delete().eq(keyColumn(table), key);
      if (error) fail(`delete from ${table}`, error);
    },

    async removeWhere(table: TableName, column: string, value: string) {
      const { error } = await supabase.from(table).delete().eq(column, value);
      if (error) fail(`delete from ${table}`, error);
    },

    async getStreak() {
      const { data: streak } = await supabase.from("streaks").select("*").maybeSingle();
      return (streak as Streak | null) ?? null;
    },

    async recordVisit() {
      // The database computes the local date from the saved profile timezone.
      const { data: streak, error } = await supabase.rpc("record_workspace_visit");
      if (error) return null;
      return streak as Streak;
    },

    async signOut() {
      await supabase.auth.signOut();
    },
  };
}
