# MindCraft

MindCraft is a personal workspace you build yourself. It gives you tasks, a calendar, notes, a timer, and practical help starting work. You choose which tools appear, how they look, and how you use them.

The name joins "mind" and "craft". Creative Mode borrows the open-ended building feel of sandbox games, including a bottom inventory. All visuals, icons, and assets are original.

This project was built for a two-week hackathon with Specialisterne. MindCraft is not clinically validated. We do not claim it suits all neurodivergent people or that it improves productivity. Those are open questions to test with users.

---

## Quick start

Requirements: Node.js 20.9 or newer (developed on Node 24) and npm.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Then open http://localhost:3000.

**No accounts needed to try it.** Without Supabase settings, the sign-in page offers a **local demo**. The demo keeps fictional data in your browser only. AI features stay off in the demo unless you set `ALLOW_DEMO_AI=true` and a `GEMINI_API_KEY` (use this for local testing only).

### Connecting Supabase (real accounts)

1. Create a project at https://supabase.com.
2. Apply every migration, in order. Either:
   - paste each file from `supabase/migrations/` into the SQL editor and run it, oldest first, or
   - use the Supabase CLI: `supabase link` then `supabase db push`.
3. In **Authentication > URL Configuration**:
   - set **Site URL** to your app URL (for example `http://localhost:3000`)
   - add `http://localhost:3000/auth/callback` (and your production equivalent) to **Redirect URLs**.
4. Copy the project URL and the publishable (anon) key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Optional: add `GEMINI_API_KEY` and `GEMINI_MODEL` to turn on the assistant.

Email confirmation follows your Supabase Auth settings. If confirmation is on, sign-up shows "Check your email". If it is off, new users go straight to setup.

### Deploying to Vercel

1. In **Vercel > Settings > Environment Variables**, set these for Production:

   | Variable | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | From the Supabase project |
   | `GEMINI_API_KEY`, `GROQ_API_KEY` | At least one, to turn on the assistant |
   | `AI_PRIMARY_PROVIDER` | `gemini` or `groq` |
   | `ALLOW_DEMO_AI` | `false` on a public deployment |
   | `NEXT_PUBLIC_ENABLE_DEMO` | `true` to offer the demo, `false` to hide it |

   See `.env.example` for the optional variables. Changing a `NEXT_PUBLIC_` value requires a new deployment, because it is built into the browser code. Never add the Supabase service role key.
2. In Supabase **Authentication > URL Configuration**, set **Site URL** to the production URL and add `https://your-domain/auth/callback` to **Redirect URLs**. If the callback is not allowed, Supabase falls back to the Site URL, so a Site URL left on localhost sends email links to localhost.
3. Apply any new files in `supabase/migrations/`, ideally before deploying. Without `20261105000000_task_estimates.sql`, confirmed plans still save but lose their estimated minutes, and the task form cannot save an estimate.
4. Run `npm run verify` and `npm run build`, then deploy. A push to the production branch deploys it. Other branches get a preview deployment.
5. After deploying, request a password reset and confirm that the email link opens the production site.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | Generates route types, then runs TypeScript |
| `npm run lint` | ESLint (Next.js core-web-vitals and TypeScript rules) |
| `npm run test:unit` | Vitest unit tests (streaks, quiet hours, layout order, AI proposal guard) |
| `npm run test:rls` | Runs the migration in in-memory Postgres (PGlite) and checks that two accounts cannot see or change each other's data |
| `npm run check:contrast` | Measures WCAG contrast for every theme and accent combination |
| `npm run verify` | Runs all of the checks above |

---

## Architecture

```
Browser (Next.js client components)
  ├─ Workspace UI: header, blocks, Creative Mode, Focus Mode, dialogs
  ├─ WorkspaceDataProvider: one in-memory store of the user's records
  │     └─ Repository ── Supabase (Postgres + RLS)   ← signed-in users
  │                   └─ localStorage               ← local demo only
  └─ fetch ──► Next.js route handlers (server)
                 ├─ /api/assistant   → Gemini (structured JSON) → Zod validation
                 ├─ /api/transcribe  → Gemini (audio → text), nothing stored
                 └─ /auth/callback   → Supabase email link exchange
src/proxy.ts: refreshes the session cookie and redirects signed-out visitors
```

### Key decisions

- **One app, one repository.** Next.js 16 App Router with TypeScript. There is no separate API service.
- **Data goes straight to Supabase, protected by Row Level Security.** CRUD calls run in the browser with the user's own session. Every table has owner-only RLS policies. Triggers stop one account from linking to another account's records (for example a step on someone else's task). Check constraints enforce text lengths and allowed values (status, block types, and so on). `npm run test:rls` verifies this.
- **Privileged work stays on the server.** Gemini calls happen only in route handlers. Each handler checks the caller's session with `getClaims()`, rate-limits the request, and validates input with Zod. The Gemini key is never sent to the browser, and the Supabase service-role key is never used.
- **Blocks are views and records are shared.** `workspace_blocks` stores only presentation: block type, display options, grid positions per breakpoint, phone order, and hidden state. Tasks, steps, notes, and events live in their own tables. Every block reads from the same in-memory store, so a change in one block shows up everywhere straight away. Removing a block never deletes content.
- **Creative Mode edits a draft.** Entering Creative Mode snapshots the block list. Undo and Redo work on a history of drafts. **Save** writes only the difference. **Cancel** discards the draft. Task edits made during the session are not part of the draft, so they survive Cancel.
- **Layouts per breakpoint.** Desktop uses a 12-column grid, tablet uses 6 columns, and phones use a single column. If a breakpoint has no saved layout, MindCraft builds one from the desktop reading order (top to bottom, then left to right). Reordering on a phone saves `mobile_order` and never changes desktop positions.
- **AI proposals are never actions.** The model returns `{ reply, question?, proposals[] }`. The server checks each proposal against a strict Zod union of the seven allowed types and drops unknown task ids. It also removes deadlines and priorities unless the user's own words mention them. The browser validates the result again, and validates once more before Apply. MindCraft never runs model-generated code, queries, or arbitrary mutations.
- **One assistant.** The chat panel, Plan my day, Help me start, and Missing information all use the same endpoint, rules, and saved conversation. Each request sends only the context it needs (see "What is sent to the AI").
- **Task plans reuse existing records.** A confirmed `task_plan` stores the deliverable in `expected_result`, the completion criterion in the Before submitting checklist, and the first action as the first step. None of these completes the task. The estimate is the optional `estimated_minutes` column.
- **Confirming twice saves once.** Each record of a plan has an id derived from the message and proposal. A double click, a retry, or another device reaches the same id, and the primary key rejects the second copy.
- **Block capabilities live in one place.** `src/lib/block-capabilities.ts` describes what each block really does, and the assistant receives that text. Placement (placed, hidden, or only in the inventory) is computed from the saved workspace, never taken from the model. Update this file whenever a block changes.
- **Groq requests stay inside the token limit.** Groq counts the prompt plus the reserved completion against tokens per minute and rejects anything over it, even on an idle account. `src/lib/ai/completion-reserve.ts` reserves only what is left. Set `GROQ_TOKENS_PER_MINUTE` if your limit is not 8000.
- **Model configuration lives in one place.** `src/lib/ai/server-env.ts` reads `GEMINI_MODEL`, with a default of `gemini-3.8-flash`. Check current model IDs at https://ai.google.dev/gemini-api/docs/models.

### Folder guide

| Path | Contents |
| --- | --- |
| `supabase/migrations/` | Schema, RLS policies, triggers, streak function |
| `src/app/` | Routes: auth pages, `/welcome` (setup), `/workspace`, API route handlers, manifest, icons |
| `src/components/blocks/` | Tasks, Calendar, Task guide, Focus timer, Notes, Resources, Check-in |
| `src/components/workspace/` | Grid, block frame, Creative Mode, inventory, empty state, search |
| `src/components/assistant/`, `planning/` | Assistant panel, proposals, voice recorder, Plan my day, daily welcome card |
| `src/components/providers/` | Data store, screen state, shared timer |
| `src/lib/` | Types, Zod schemas, themes, preferences, layout logic, block capabilities, dates, AI helpers, repositories |
| `scripts/` | RLS test and contrast checker |

### Assistant task plans

When someone describes work and no material detail is missing, the assistant returns a `task_plan` card. If a missing detail would change the result, it asks one short question instead. The card shows:

- an action-oriented title, the deliverable, and a completion criterion
- an estimated time block in minutes, which is an editable planning suggestion
- a small first action
- the recommended workspace block and why, with an optional alternative

Each field is labeled **From you** or **Suggested**. The server keeps a **From you** label only if most of the words came from the person or the selected task. Fields you edit become yours. A deadline or priority stays only if the person stated one.

| Workspace block | Recommended when |
| --- | --- |
| Tasks | The person needs an overview, or the work must be compared with other tasks |
| Calendar | The work has a deadline, or the blocker is finding time |
| Task guide | The person knows the task but not how to proceed, or it has several steps. Also the fallback when the model recommends nothing |
| Focus timer | The work is decided and a time-boxed session helps. Never after the person declined timers |
| Notes | The deliverable starts as thinking, rough writing, or findings |
| Resources | The task depends on web links or shared documents |
| Check-in | The blocker depends on another person, or an update must be prepared. Entries stay private drafts |

**Confirm and apply** is the only action that saves. It creates the task, or adds to the selected task without overwriting its instructions or filled fields. It adds a missing block, or shows a hidden one, and the button says so first. **Choose another block** works from the card, and **Dismiss** changes nothing. After confirming, **Start first action** opens the task in Focus Mode. Finishing that step never completes the task.

Tasks also offer **Make a clear plan**, **Break this down**, and **Draft a clarifying question** in their menu.

Saved preferences reach the assistant as direct instructions for each reply: response detail, planning style, task presentation, and session length. People can change or clear them in **Settings > AI and privacy**, and change or remove their name in **Profile**. There are no managers or shared views, so conversations and preferences stay with the account owner under RLS.

If a request fails, the text stays in the box. The panel offers **Try again** and **Add a task myself**, and the browser stops waiting after 45 seconds. Proposals are validated on the server, in the browser, and again at Confirm. Task content is sent as data and cannot override the rules.

### What is sent to the AI

Requests go from the server to Gemini or Groq. `AI_PRIMARY_PROVIDER` sets which one is tried first, and the other is the backup when its key is configured, so a request may reach both. The assistant receives only these items:

- the user's message and the last few chat messages
- the display name, so the assistant can address the person by it
- the selected task (title, description, expected result, deadline, priority, status, steps)
- titles, status, and deadlines of other open tasks
- the block types in the workspace, including hidden ones
- preferences: response detail, language, planning style, task presentation, focus time, focus length, and what helps the person get started
- choices the user has stated, such as "no timer"

Notes, calendar events, email, and other settings are never sent. A voice recording is sent once for transcription and is not stored. The same explanation appears in **Settings > AI and privacy**.

---

## Capability status

### Implemented

- Sign up, sign in, email confirmation (when enabled in Supabase), password recovery, and sign out, with loading, validation, and error states. Supabase Auth handles all passwords.
- Short setup with a live preview. The display name is required; theme and accent, font, text size, line spacing, density, how the person likes to work, preferred tools, and reminders can be skipped with **Use defaults** or **Set this up later**.
- New accounts start with an empty workspace showing "Your space, your way." and the actions Build my space, Help me choose, and Plan my day. A starter layout appears only as a preview and is added only after confirmation.
- Compact header with profile menu (Profile, Appearance and reading, Workspace preferences, Notifications, AI and privacy, Account, Sign out), workspace name, an optional streak, and three modes. There is no sidebar.
- **Creative Mode:** compact toolbar with numbered slots, plus an inventory panel organized into Planning, Focus, and Support. Drag from either one or click to add. Arrow keys, Enter, and number keys work in the toolbar. Also includes header-only drag handles, resizing with minimum sizes, snap grid, Save, Cancel, Undo, Redo (also Ctrl+Z, Ctrl+Shift+Z, and Ctrl+Y), hide or remove with an explanation, and non-drag controls (Move earlier or later, size presets, move left, right, up, or down).
- **Blocks:**
  - **Tasks:** list or board, status dropdown and drag between columns, All, Today, Upcoming, Overdue, and Completed filters, and sorting by deadline, priority, or title. The board's All filter also shows done tasks, so its Done column works.
  - **Calendar:** month, week, and day views plus an agenda, using the profile timezone. Date-only deadlines appear all day and timed deadlines at their time. Events and work sessions are edited separately from deadlines, which change only through **Edit deadline** in task details.
  - **Task guide:** task details, ordered steps in One step or All steps view, a separate "Before submitting" checklist, linked resources, and **Mark task done**. Neither checklist completes a task.
  - **Focus timer:** countdown or stopwatch based on timestamps, so a session survives a refresh. Optional break and sound. One shared session is used by every timer block and Focus Mode.
  - **Notes:** plain text, bullets, and checklists, pinning, autosave status, and links to one task or project.
  - **Resources:** saved links with list or card views, favorites, and filters.
  - **Check-in:** progress updates and help requests saved as private drafts. Help requests have Open, Waiting, and Resolved statuses and follow-ups.
- Focus Mode: selected task, expected result, current step, resources (source link and linked notes), an optional timer, Help me start, and I'm blocked. Leaving it restores the saved workspace untouched.
- Assistant panel (side panel on desktop, full screen on phones) with proposals you can Apply, Edit, or Dismiss, and editable task plans with a recommended workspace block. Errors offer Retry and a manual path, and your text is kept.
- Daily welcome card (once per local day, dismissible) with text, voice, and four quick choices. Plan my day covers text and voice with an editable transcript.
- Voice capture: the microphone is requested only after you press Record. The recorder shows recording, stop, cancel, and processing states. Recordings are limited to 2 minutes and 5 MB, and the server checks the file type. Typing always works as an alternative.
- Seventeen complete themes (Warm Studio, Clear Blue, Rose Clay, Sage Garden, Lavender Mist, Ocean Breeze, Colorful, Monochrome, Midnight, Dark Cocoa, Sunset Pop, Tropical Splash, Neon Night, Quiet Paper, Quiet Night, Blue & Orange, Blue & Orange Dark) and five accents. Sunset Pop, Tropical Splash, and Neon Night are multicolor and tint each block header. Quiet Paper and Quiet Night each stay within a single hue. Blue & Orange and its dark version use a color pair that stays distinct for most types of color blindness. Status and selection are shown with words or symbols as well as color. Each accent has a light and a dark variant.
- Reading preferences: font (System default, Arial, Verdana, Open Sans, Lexend, Atkinson Hyperlegible, Comic Neue, OpenDyslexic), text size, line spacing, letter spacing, word spacing, and density. Some people find the reading fonts easier to use, but they are options to try: MindCraft does not claim that any font treats dyslexia. These apply everywhere, including dialogs and chat. Each setting has **Reset**, and there is **Restore appearance defaults**.
- Optional streak: one visit per local day, using the saved timezone. Current and best streaks are stored and the streak can be hidden. There are no penalties.
- In-app reminders: Off, Friendly, Playful, or Minimal, with quiet hours, a preferred time, an inactivity threshold, snooze, and turn off.
- PWA: manifest, generated icons, and a service worker that caches the app shell and serves an offline page. An offline banner appears, and unsent chat and planning text is kept on the device.
- Settings controls to clear chat history, reset the workspace layout, and reset all preferences.

### Deferred (not built)

- **Browser push notifications.** These need permission, saved subscriptions, and a server-side scheduler. There is no `push_subscriptions` table yet.
- Offline editing and sync. Edits made while offline are not queued.
- Using AI to interpret free-form setup answers. The assistant can suggest preference changes in chat, but the setup screen does not use AI.
- Self-service account deletion. This needs a privileged server function.
- Daily Schedule, Upcoming, routines with recurrence, a streak block, and a Timeline view.
- Calendar sync with Google or Outlook.
- Sharing Check-in entries. There are no team members, managers, or a team view yet, so Share stays disabled and entries remain private drafts.
- File uploads in Resources. There is no file storage, so only links can be added.
- Dragging work sessions on the calendar. Sessions move through their edit form.
- A shared rate limiter across server instances. The current limiter is in memory and protects only a single instance.

### Simulated or limited

- **Reminders are in-app only.** They appear while MindCraft is open, either when you return after the inactivity period or at the preferred time. Nothing is sent while the app is closed.
- **Local demo mode** stores fictional data in `localStorage`. It is a convenience for exploring the app, not a real account. Its streak logic mirrors the SQL function.
- The service worker does not make the app usable offline. It shows an offline page and caches static assets.

---

## Validation results

Run on 2026-11-02, with theme checks updated on 2026-11-03:

| Check | Result |
| --- | --- |
| TypeScript (`tsc --noEmit`) | Passed, 0 errors |
| ESLint | Passed, 0 problems |
| Production build (`next build`) | Passed |
| Unit tests (Vitest) | 36 of 36 passed |
| RLS isolation (PGlite, two accounts) | 36 of 36 checks passed |
| Theme contrast (17 themes × 6 accent options) | All text pairs ≥ 4.5:1 and all control borders and focus indicators ≥ 3:1, also under simulated protanopia, deuteranopia, and tritanopia |

**Manual browser walkthrough (local demo, desktop 1366×860 and phone 375×812):** setup with live theme preview; empty workspace; adding blocks by pressing (no dragging); header drag; Undo, Redo, and Cancel restoring positions; Save surviving a reload; marking a step done without completing the task; completing a task updating Task List, Next step, and the calendar deadline; Focus Mode exit leaving the layout unchanged; removing the Task List block keeping all tasks; AI failure keeping the draft and changing no data; phone view in the desktop reading order with no horizontal scrolling; phone reordering through the bottom sheet; API returning 401 when signed out and 403 for the demo without opt-in.

**Not yet verified:**

- Real Gemini responses. No API key was available during development, so we could not confirm that the model follows the response schema. The validation and error paths are tested.
- Real Supabase email flows. RLS was tested in PGlite with a stand-in for the `auth` schema, not on a hosted Supabase project.
- Screen-reader testing with NVDA, JAWS, or VoiceOver.
- Testing with users.

Following WCAG 2.2 AA practices is a goal, not a certification.

### Acceptance checks

| # | Check | How it is covered |
| --- | --- | --- |
| 1 | Skip setup and reach an empty workspace | After the required name, "Set this up later" plus the new-user trigger, which creates no blocks (RLS test) |
| 2 | Suggested blocks need confirmation | Starter layout is preview-only; proposals need Apply |
| 3 | Add a block without dragging | Inventory buttons and tap-to-add (walkthrough) |
| 4 | Layout and preferences persist | Saved to the database or demo storage; reload checked |
| 5 | Removing Task List keeps tasks | RLS test plus walkthrough |
| 6 | Task updates reach all views | One shared store (walkthrough) |
| 7 | Missing deadline stays unspecified | `due_date` is nullable and never guessed; unit test strips invented dates |
| 8 | Focus Mode restores workspace | Focus Mode never writes layout (walkthrough) |
| 9 | Declined timer respected | Declines detected and sent as context, plus an assistant rule (unit test) |
| 10 | Proposals do not alter data before confirmation | AI endpoints never write; Apply is the only path |
| 11 | Microphone denial leaves text | Recorder error message; the text box is always present |
| 12 | API failure keeps tasks and drafts | Walkthrough; drafts are kept in localStorage |
| 13 | Accounts isolated | `npm run test:rls` |
| 14 | Mobile preserves desktop arrangement | Unit test plus phone walkthrough |
| 15 | No credentials in browser code | Only `NEXT_PUBLIC_SUPABASE_*` public values reach the client |
| 16 | Streak uses local calendar days | SQL function uses the profile timezone; unit and RLS tests |
| 17 | Disabled reminders schedule nothing | Style "Off" returns before any timer is created |

---

## Demonstration data

`src/lib/demo/sample-data.ts` contains fictional tasks, notes, and an event, for example the made-up "Northwind Bakery". This data is loaded only into the local demo and is never written to Supabase.

## AI assistance disclosure

An AI coding assistant (Claude, by Anthropic) generated most of this codebase from the team's written brief. That includes the schema, the components, the tests, and this README. The team should review, test, and adapt the code before relying on it. The AI did not run user research and could not test the app with real Gemini or Supabase credentials. Any claims about benefits for users still need evaluation with users.
