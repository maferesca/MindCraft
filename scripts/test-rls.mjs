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

// MindCraft Journey: rewards are decided here, and no client can write them.
const carol = "44444444-4444-4444-8444-444444444444";
await db.exec(`insert into auth.users (id, email) values ('${carol}', 'carol@example.test');`);
const xpOf = async (user) => (await as(user, "select coalesce((select total_xp from user_progress), 0) as total")).rows[0].total;
const rewards = async (user, action) => (await as(user, "select amount from xp_transactions where action = $1", [action])).rows;
const newTask = async (user, title, extra = "") => (await as(user, `insert into tasks (user_id, title${extra ? ", due_date" : ""}) values ($1, $2${extra ? ", " + extra : ""}) returning id`, [user, title])).rows[0].id;
const complete = (user, id) => as(user, "update tasks set status = 'done' where id = $1", [id]);

const plain = await newTask(carol, "No deadline");
await complete(carol, plain);
check("A task without a deadline earns the base 20 XP", (await xpOf(carol)) === 20);
await as(carol, "update tasks set status = 'todo' where id = $1", [plain]);
await complete(carol, plain);
check("Reopening and completing a task earns nothing more", (await xpOf(carol)) === 20);
check("A task's first completion unlocks First Step", (await as(carol, "select * from user_achievements where achievement = 'first_step'")).rows.length === 1);

const again = await newTask(carol, "no deadline ");
await complete(carol, again);
check("A task recreated with the same title earns nothing that day", (await xpOf(carol)) === 20);

const early = await newTask(carol, "Early task", "(now() + interval '10 days')::date");
await db.exec(`alter table tasks disable trigger tasks_deadline_snapshot; update tasks set xp_deadline_set_at = now() - interval '1 day' where id = '${early}'; alter table tasks enable trigger tasks_deadline_snapshot;`);
await as(carol, "update tasks set due_date = (now() + interval '40 days')::date where id = $1", [early]);
const snapshot = (await as(carol, "select xp_deadline::date::text as d, due_date::text as e from tasks where id = $1", [early])).rows[0];
check("Changing a deadline keeps the original snapshot", snapshot.d !== snapshot.e);
await complete(carol, early);
check("Finishing with most of the time left earns +15", (await rewards(carol, "early_bonus"))[0]?.amount === 15);
check("The full bonus unlocks Early Bird", (await as(carol, "select * from user_achievements where achievement = 'early_bird'")).rows.length === 1);
const afterBonus = await xpOf(carol);
await as(carol, "update tasks set due_date = (now() + interval '80 days')::date, status = 'todo' where id = $1", [early]);
await complete(carol, early);
check("Editing a deadline and completing again adds no bonus", (await xpOf(carol)) === afterBonus);

const late = await newTask(carol, "Late task", "(now() - interval '3 days')::date");
await complete(carol, late);
check("A late task still earns base XP and no bonus", (await xpOf(carol)) === afterBonus + 20 && (await rewards(carol, "early_bonus")).length === 1);
const instant = await newTask(carol, "Instant task", "(now() + interval '30 days')::date");
await complete(carol, instant);
check("A far deadline on a brand new task earns no bonus", (await rewards(carol, "early_bonus")).length === 1);

const bonusAt = async (deadline, setAt, done) => (await db.query(`select public.xp_deadline_bonus(${deadline}, ${setAt}, ${done}) as b`)).rows[0].b;
const base = "timestamptz '2026-01-01 00:00Z'";
const at = (hours) => `${base} + interval '${hours} hours'`;
check("50% of the time left earns +15", (await bonusAt(at(100), base, at(50))) === 15);
check("Just under 50% earns +10", (await bonusAt(at(100), base, at(51))) === 10);
check("20% earns +10", (await bonusAt(at(100), base, at(80))) === 10);
check("Under 20% earns +5", (await bonusAt(at(100), base, at(99))) === 5);
check("At the deadline earns +0", (await bonusAt(at(100), base, at(100))) === 0);
check("After the deadline earns +0", (await bonusAt(at(100), base, at(101))) === 0);
check("A deadline before its start earns +0", (await bonusAt(base, at(5), at(1))) === 0);
check("Under an hour of notice earns +0", (await bonusAt(at(0.5), base, at(0.25))) === 0);
check("Under six hours of notice earns at most +5", (await bonusAt(at(5), base, at(1))) === 5);

const blockerTask = await newTask(carol, "Blocked task");
const blocker = (await as(carol, "insert into check_ins (user_id, kind, task_id, blocking, support, help_status) values ($1, 'help', $2, 'Need access', 'Ask IT', 'open') returning id", [carol, blockerTask])).rows[0].id;
await as(carol, "update check_ins set help_status = 'resolved' where id = $1", [blocker]);
check("A blocker resolved right after writing it earns nothing", (await rewards(carol, "blocker_resolved")).length === 0);
await as(carol, "update check_ins set help_status = 'open' where id = $1", [blocker]);
await db.exec(`alter table check_ins disable trigger check_ins_touch; update check_ins set created_at = now() - interval '1 day' where id = '${blocker}'; alter table check_ins enable trigger check_ins_touch;`);
await as(carol, "update check_ins set help_status = 'resolved' where id = $1", [blocker]);
await as(carol, "update check_ins set help_status = 'open' where id = $1", [blocker]);
await as(carol, "update check_ins set help_status = 'resolved' where id = $1", [blocker]);
check("Resolving a blocker earns +10 once", (await rewards(carol, "blocker_resolved")).length === 1);
check("A resolved blocker unlocks Problem Solver", (await as(carol, "select * from user_achievements where achievement = 'problem_solver'")).rows.length === 1);

const focusTask = await newTask(carol, "Focus task");
await as(carol, "select award_focus_start($1)", [focusTask]);
await as(carol, "select award_focus_start($1)", [focusTask]);
check("Starting Focus Mode earns +5 once per task", (await rewards(carol, "focus_start")).length === 1);
const stepTask = await newTask(carol, "Step task");
await as(carol, "insert into task_steps (user_id, task_id, text, position) values ($1, $2, 'One', 0), ($1, $2, 'Two', 1)", [carol, stepTask]);
await as(carol, "select award_first_step($1)", [stepTask]);
check("The first step earns nothing until it is done", (await rewards(carol, "first_step")).length === 0);
await as(carol, "update task_steps set done = true where task_id = $1 and position = 0", [stepTask]);
await as(carol, "select award_first_step($1)", [stepTask]);
await as(carol, "select award_first_step($1)", [stepTask]);
check("The first step earns +5 once", (await rewards(carol, "first_step")).length === 1);

for (let i = 0; i < 4; i += 1) { await as(carol, "select begin_focus_session()"); await as(carol, "select finish_focus_session()"); }
check("Short sessions do not count as focus sessions", (await as(carol, "select * from focus_sessions where counted")).rows.length === 0);
check("A session cannot be claimed without passing time", (await as(carol, "select * from user_achievements where achievement = 'focus_explorer'")).rows.length === 0);

const totalBeforeDelete = await xpOf(carol);
await as(carol, "delete from tasks where id = $1", [late]);
check("Deleting a task keeps its earned XP", (await xpOf(carol)) === totalBeforeDelete);
const summed = (await as(carol, "select coalesce(sum(amount), 0)::int as total from xp_transactions")).rows[0].total;
check("Total XP matches the sum of its transactions", summed === totalBeforeDelete);

check("Bob cannot read Carol's XP", (await as(bob, "select * from xp_transactions where user_id = $1", [carol])).rows.length === 0);
check("Bob cannot read Carol's progress", (await as(bob, "select * from user_progress where user_id = $1", [carol])).rows.length === 0);
check("Bob cannot read Carol's achievements", (await as(bob, "select * from user_achievements where user_id = $1", [carol])).rows.length === 0);
check("Nobody can write their own XP total", await fails(carol, "update user_progress set total_xp = 99999"));
check("Nobody can insert their own progress", await fails(bob, "insert into user_progress (user_id, total_xp) values ($1, 99999)", [bob]));
check("Nobody can insert XP transactions", await fails(carol, "insert into xp_transactions (user_id, action, amount, source_key, label) values ($1, 'task_complete', 999, 'x', 'x')", [carol]));
check("Nobody can delete XP transactions", await fails(carol, "delete from xp_transactions"));
check("Nobody can grant their own achievement", await fails(bob, "insert into user_achievements (user_id, achievement) values ($1, 'early_bird')", [bob]));
check("Nobody can call the XP award function", await fails(carol, "select award_xp($1, 'task_complete', 999, 'x', 'x', null, null)", [carol]));
check("Nobody can edit a focus session", await fails(carol, "update focus_sessions set counted = true"));
await as(bob, "select award_focus_start($1)", [focusTask]);
await as(bob, "select award_first_step($1)", [stepTask]);
check("Bob cannot earn XP from Carol's tasks", (await as(bob, "select * from xp_transactions")).rows.length === 0);
await as(carol, "update tasks set xp_deadline = now() + interval '900 days', xp_deadline_set_at = now() - interval '900 days' where id = $1", [focusTask]);
check("Nobody can edit a deadline snapshot", (await as(carol, "select xp_deadline from tasks where id = $1", [focusTask])).rows[0].xp_deadline === null);

for (let i = 0; i < 25; i += 1) await complete(bob, await newTask(bob, `Bulk ${i}`));
check("Task completion XP stops at the daily limit", (await rewards(bob, "task_complete")).length === 20);

console.log(failures === 0 ? "\nAll RLS checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
