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

// The first migration's tables get their grants from Supabase defaults. Later
// migrations must grant their own, so this only covers the initial tables.
await db.exec(`
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on public.profiles, public.preferences, public.notification_preferences,
    public.workspaces, public.workspace_blocks, public.tasks, public.task_steps, public.notes, public.calendar_events,
    public.conversations, public.messages, public.daily_activity, public.streaks to authenticated;
`);

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
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

// Second migration: projects, review checklists, resources, and check-ins.
const aliceProject = (await as(alice, "insert into projects (user_id, name) values ($1, 'Launch') returning id", [alice])).rows[0].id;
const reviewItem = await as(alice, "insert into task_review_items (user_id, task_id, text) values ($1, $2, 'Spell check') returning id", [alice, aliceTaskId]);
const resource = await as(alice, "insert into resources (user_id, name, url, task_id) values ($1, 'Brief', 'https://example.test/brief', $2) returning id", [alice, aliceTaskId]);
const checkIn = await as(alice, "insert into check_ins (user_id, kind, task_id, next_text) values ($1, 'progress', $2, 'Finish slides') returning id", [alice, aliceTaskId]);
for (const table of ["projects", "task_review_items", "resources", "check_ins"]) {
  check(`Bob cannot read Alice's ${table}`, (await as(bob, `select * from ${table}`)).rows.length === 0);
}
check("Bob cannot update Alice's resource", (await as(bob, "update resources set name = 'x' where id = $1 returning id", [resource.rows[0].id])).rows.length === 0);
check("Bob cannot delete Alice's check-in", (await as(bob, "delete from check_ins where id = $1 returning id", [checkIn.rows[0].id])).rows.length === 0);
check("Bob cannot link a resource to Alice's task",
  await fails(bob, "insert into resources (user_id, name, url, task_id) values ($1, 'x', 'https://example.test', $2)", [bob, aliceTaskId]));
check("Bob cannot put a task in Alice's project",
  await fails(bob, "insert into tasks (user_id, title, project_id) values ($1, 'x', $2)", [bob, aliceProject]));
check("Bob cannot add review items to Alice's task",
  await fails(bob, "insert into task_review_items (user_id, task_id, text) values ($1, $2, 'x')", [bob, aliceTaskId]));
check("Resources must use http or https",
  await fails(alice, "insert into resources (user_id, name, url) values ($1, 'x', 'javascript:alert(1)')", [alice]));
check("The old blocked status is rejected",
  await fails(alice, "update tasks set status = 'blocked' where id = $1", [aliceTaskId]));
check("A note cannot link to a task and a project",
  await fails(alice, "insert into notes (user_id, body, task_id, project_id) values ($1, 'x', $2, $3)", [alice, aliceTaskId, aliceProject]));
check("A progress update needs Completed or Next",
  await fails(alice, "insert into check_ins (user_id, kind) values ($1, 'progress')", [alice]));
check("A help request needs both written fields",
  await fails(alice, "insert into check_ins (user_id, kind, blocking, help_status) values ($1, 'help', 'x', 'open')", [alice]));

// Calendar sessions and blocks never change task content.
await as(alice, "update tasks set due_date = '2026-12-01' where id = $1", [aliceTaskId]);
const session = await as(alice,
  "insert into calendar_events (user_id, title, kind, starts_at, ends_at, task_id) values ($1, 'Work session', 'work_session', '2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z', $2) returning id",
  [alice, aliceTaskId]);
await as(alice, "update calendar_events set starts_at = '2026-11-21T10:00:00Z', ends_at = '2026-11-21T11:00:00Z' where id = $1", [session.rows[0].id]);
await as(alice, "delete from calendar_events where id = $1", [session.rows[0].id]);
const afterSession = await as(alice, "select due_date::text from tasks where id = $1", [aliceTaskId]);
check("Moving and deleting a work session keeps the task and its deadline", afterSession.rows[0]?.due_date === "2026-12-01");
const resourceBlock = await as(alice,
  "insert into workspace_blocks (user_id, workspace_id, block_type) values ($1, $2, 'resources') returning id", [alice, workspaceId]);
const checkInBlock = await as(alice,
  "insert into workspace_blocks (user_id, workspace_id, block_type) values ($1, $2, 'check_in') returning id", [alice, workspaceId]);
await as(alice, "delete from workspace_blocks where id = any($1::uuid[])", [[resourceBlock.rows[0].id, checkInBlock.rows[0].id]]);
check("Removing Resources and Check-in blocks keeps their content",
  (await as(alice, "select * from resources")).rows.length === 1 && (await as(alice, "select * from check_ins")).rows.length === 1);
await as(alice, "delete from task_review_items where id = $1", [reviewItem.rows[0].id]);

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

// Task estimates and repeated proposal ids.
const planId = "33333333-3333-4333-8333-333333333333";
const planInsert = `insert into tasks (id, user_id, title, estimated_minutes) values ('${planId}', '${alice}', 'Plan task', 30) returning id`;
await as(alice, planInsert);
check("A task keeps its estimated minutes", (await as(alice, `select estimated_minutes from tasks where id = '${planId}'`)).rows[0]?.estimated_minutes === 30);
check("Confirming a proposal twice cannot create a second task", await fails(alice, planInsert));
check("An estimate outside 1 to 600 minutes is rejected", await fails(alice, `insert into tasks (user_id, title, estimated_minutes) values ('${alice}', 'Too long', 601)`));
check("Bob cannot see Alice's plan task", (await as(bob, `select id from tasks where id = '${planId}'`)).rows.length === 0);

// Task blocks and work groups.
const aliceList = (await as(alice, "insert into workspace_blocks (user_id, workspace_id, block_type, title, group_id, group_title) values ($1, $2, 'task_list', 'Launch', gen_random_uuid(), 'Launch group') returning id", [alice, workspaceId])).rows[0].id;
const notesBlock = (await as(alice, "insert into workspace_blocks (user_id, workspace_id, block_type) values ($1, $2, 'notes') returning id", [alice, workspaceId])).rows[0].id;
const blockTask = (await as(alice, "insert into tasks (user_id, title, block_id) values ($1, 'In a block', $2) returning id", [alice, aliceList])).rows[0].id;
const bobTask = (await as(bob, "insert into tasks (user_id, title) values ($1, 'Bob task') returning id", [bob])).rows[0].id;
check("A task keeps its task block", (await as(alice, "select block_id from tasks where id = $1", [blockTask])).rows[0]?.block_id === aliceList);
check("Bob cannot put a task in Alice's task block", await fails(bob, "update tasks set block_id = $1 where id = $2", [aliceList, bobTask]));
check("Bob cannot create a task in Alice's task block", await fails(bob, "insert into tasks (user_id, title, block_id) values ($1, 'x', $2)", [bob, aliceList]));
check("A task can only belong to a task block", await fails(alice, "update tasks set block_id = $1 where id = $2", [notesBlock, blockTask]));
check("Bob cannot read Alice's groups", (await as(bob, "select * from workspace_blocks where group_id is not null")).rows.length === 0);
check("A group title has a length limit", await fails(alice, "update workspace_blocks set group_title = repeat('x', 61) where id = $1", [aliceList]));
await as(alice, "update workspace_blocks set group_id = null, group_title = null where id = $1", [aliceList]);
check("Removing a group keeps its block", (await as(alice, "select id from workspace_blocks where id = $1", [aliceList])).rows.length === 1);
await as(alice, "delete from workspace_blocks where id = $1", [aliceList]);
const afterBlock = await as(alice, "select block_id, title from tasks where id = $1", [blockTask]);
check("Removing a task block keeps its tasks", afterBlock.rows[0]?.title === "In a block" && afterBlock.rows[0]?.block_id === null);

console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
