// Runs the Supabase migrations in an in-memory Postgres (PGlite) with a
// minimal stand-in for Supabase's auth schema, then checks that two accounts
// cannot read or modify each other's records.
//
// Usage: npm run test:rls

import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const db = new PGlite();
let failures = 0;

function check(name, condition) {
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}`);
  if (!condition) failures += 1;
}

// Minimal Supabase auth stand-in: auth.users and auth.uid().
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

const migrationsDir = join(process.cwd(), "supabase", "migrations");
for (const file of readdirSync(migrationsDir).sort()) {
  await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
}

await db.exec(`
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
`);

const alice = "11111111-1111-1111-1111-111111111111";
const bob = "22222222-2222-2222-2222-222222222222";
await db.exec(`insert into auth.users (id, email) values
  ('${alice}', 'alice@example.test'), ('${bob}', 'bob@example.test');`);

async function as(userId, sql, params = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${userId}', false); set role authenticated;`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role;");
  }
}

async function fails(userId, sql, params = []) {
  try {
    await as(userId, sql, params);
    return false;
  } catch {
    return true;
  }
}

// Bootstrap trigger created empty records for both users.
const aliceWorkspaces = await as(alice, "select * from workspaces");
check("New user gets exactly one empty workspace", aliceWorkspaces.rows.length === 1);
const aliceBlocks = await as(alice, "select * from workspace_blocks");
check("New workspace has no blocks", aliceBlocks.rows.length === 0);

const aliceTask = await as(alice, "insert into tasks (user_id, title) values ($1, 'Prepare slides') returning id, due_date", [alice]);
const aliceTaskId = aliceTask.rows[0].id;
check("Task without deadline keeps due_date empty", aliceTask.rows[0].due_date === null);

check("Bob cannot read Alice's tasks", (await as(bob, "select * from tasks")).rows.length === 0);
const bobUpdate = await as(bob, "update tasks set title = 'hacked' where id = $1 returning id", [aliceTaskId]);
check("Bob cannot update Alice's task", bobUpdate.rows.length === 0);
const bobDelete = await as(bob, "delete from tasks where id = $1 returning id", [aliceTaskId]);
check("Bob cannot delete Alice's task", bobDelete.rows.length === 0);
check("Bob cannot insert a task owned by Alice",
  await fails(bob, "insert into tasks (user_id, title) values ($1, 'x')", [alice]));
check("Bob cannot attach a step to Alice's task",
  await fails(bob, "insert into task_steps (user_id, task_id, text) values ($1, $2, 'x')", [bob, aliceTaskId]));
check("Bob cannot link a note to Alice's task",
  await fails(bob, "insert into notes (user_id, body, task_id) values ($1, 'x', $2)", [bob, aliceTaskId]));
check("Bob cannot read Alice's profile", (await as(bob, "select * from profiles where user_id = $1", [alice])).rows.length === 0);
check("Bob cannot read Alice's preferences", (await as(bob, "select * from preferences where user_id = $1", [alice])).rows.length === 0);

// Removing a task-list block must not remove tasks.
const workspaceId = aliceWorkspaces.rows[0].id;
const block = await as(alice,
  "insert into workspace_blocks (user_id, workspace_id, block_type) values ($1, $2, 'task_list') returning id",
  [alice, workspaceId]);
await as(alice, "delete from workspace_blocks where id = $1", [block.rows[0].id]);
check("Removing a Task List block preserves tasks", (await as(alice, "select * from tasks")).rows.length === 1);
check("Bob cannot add a block to Alice's workspace",
  await fails(bob, "insert into workspace_blocks (user_id, workspace_id, block_type) values ($1, $2, 'notes')", [bob, workspaceId]));
check("Unknown block types are rejected",
  await fails(alice, "insert into workspace_blocks (user_id, workspace_id, block_type) values ($1, $2, 'script')", [alice, workspaceId]));

// Streak: one qualifying visit per local day.
const first = await as(alice, "select * from record_workspace_visit()");
const second = await as(alice, "select * from record_workspace_visit()");
check("First visit starts a streak of 1", first.rows[0].current_streak === 1);
check("Second visit on the same day does not double count", second.rows[0].current_streak === 1);
await db.exec(`update streaks set last_visit_date = last_visit_date - 1 where user_id = '${alice}'`);
await db.exec(`delete from daily_activity where user_id = '${alice}'`);
const nextDay = await as(alice, "select * from record_workspace_visit()");
check("Visit on the following day extends the streak", nextDay.rows[0].current_streak === 2 && nextDay.rows[0].best_streak === 2);
await db.exec(`update streaks set last_visit_date = last_visit_date - 3 where user_id = '${alice}'`);
await db.exec(`delete from daily_activity where user_id = '${alice}'`);
const afterGap = await as(alice, "select * from record_workspace_visit()");
check("A gap resets the current streak but keeps the best", afterGap.rows[0].current_streak === 1 && afterGap.rows[0].best_streak === 2);
check("Bob cannot read Alice's streak", (await as(bob, "select * from streaks where user_id = $1", [alice])).rows.length === 0);

check("Anonymous requests see no tasks", await (async () => {
  await db.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role anon;");
  try {
    const result = await db.query("select * from tasks");
    return result.rows.length === 0;
  } catch {
    return true;
  } finally {
    await db.exec("reset role;");
  }
})());

console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
