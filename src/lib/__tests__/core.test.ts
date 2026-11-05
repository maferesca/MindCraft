import { describe, expect, it } from "vitest";
import { buildContextText } from "../ai/assistant-prompt";
import { completionReserve, trimHistory } from "../ai/completion-reserve";
import { ensureFirstAction, sanitizeProposals, stripInlineMarkdown } from "../ai/proposal-guard";
import { aiUnavailableMessage, detectDeclines, isTemporaryAiFailure } from "../ai/client";
import { CATALOG_ITEMS, catalogItemFor } from "../block-catalog";
import { BLOCK_CAPABILITIES, blockPlacement, capabilityText } from "../block-capabilities";
import { BLOCK_ORDER, isMinimized, positionsForBreakpoint, sortForPhone } from "../blocks";
import { clearSessionData } from "../clear-session-data";
import { RepositoryError, type Repository } from "../data/repository";
import { createWriteTracker } from "../data/write-tracker";
import { isWithinQuietHours, nextStreak } from "../dates";
import { moveInOrder } from "../layout-edit";
import { DEFAULT_PREFERENCES, normalizePreferences } from "../preferences";
import { proposalSchema, taskInputSchema, type AssistantContext, type Proposal } from "../schemas";
import { findNamedTask, isVagueTitle, proposalRecordId } from "../task-plan";
import { stepWindow, taskBlockers } from "../task-helpers";
import { THEME_IDS } from "../themes";
import type { CheckIn, WorkspaceBlock } from "../types";

const TASK_ID = "6f1c2c7e-6a43-4e0a-9d1b-2f6c2c1a9b10";

function block(id: string, x: number, y: number, extra: Partial<WorkspaceBlock> = {}): WorkspaceBlock {
  return {
    id,
    user_id: "u",
    workspace_id: "w",
    block_type: "notes",
    title: null,
    config: {},
    layouts: { lg: { x, y, w: 4, h: 6 } },
    mobile_order: 0,
    hidden: false,
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

describe("streak (acceptance check 16)", () => {
  it("counts at most one visit per local day", () => {
    const first = nextStreak(null, "2026-11-02");
    expect(first.current_streak).toBe(1);
    expect(nextStreak(first, "2026-11-02")).toEqual(first);
  });
  it("extends on consecutive days and resets after a gap, keeping the best", () => {
    const day2 = nextStreak(nextStreak(null, "2026-11-02"), "2026-11-03");
    expect(day2.current_streak).toBe(2);
    const afterGap = nextStreak(day2, "2026-11-06");
    expect(afterGap).toMatchObject({ current_streak: 1, best_streak: 2 });
  });
  it("handles month boundaries", () => {
    expect(nextStreak({ current_streak: 3, best_streak: 3, last_visit_date: "2026-10-31" }, "2026-11-01").current_streak).toBe(4);
  });
});

describe("quiet hours", () => {
  const at = (iso: string) => new Date(iso);
  it("supports ranges that cross midnight", () => {
    expect(isWithinQuietHours("22:00", "07:00", at("2026-11-02T23:30:00Z"), "UTC")).toBe(true);
    expect(isWithinQuietHours("22:00", "07:00", at("2026-11-02T12:00:00Z"), "UTC")).toBe(false);
  });
  it("uses the saved timezone", () => {
    // 21:30 UTC is 22:30 in Copenhagen (CET, UTC+1 in November).
    expect(isWithinQuietHours("22:00", "07:00", at("2026-11-02T21:30:00Z"), "Europe/Copenhagen")).toBe(true);
  });
});

describe("responsive layout (acceptance check 14)", () => {
  const blocks = [block("c", 0, 6), block("a", 0, 0), block("b", 4, 0)];
  it("phone order follows the desktop reading order", () => {
    expect(sortForPhone(blocks).map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
  it("tablet positions keep the desktop reading order when none are saved", () => {
    const positions = positionsForBreakpoint(blocks, "md");
    const order = Object.entries(positions)
      .sort(([, p], [, q]) => p.y - q.y || p.x - q.x)
      .map(([id]) => id);
    expect(order).toEqual(["a", "b", "c"]);
  });
  it("reordering on a phone does not change desktop positions", () => {
    const moved = moveInOrder(blocks, "c", -1, "sm");
    expect(sortForPhone(moved).map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(moved.map((item) => item.layouts.lg)).toEqual(blocks.map((item) => item.layouts.lg));
  });
});

describe("AI proposal guard (acceptance checks 7 and 10)", () => {
  const context: AssistantContext = { mode: "planning", task: null, otherTasks: [{ id: TASK_ID, title: "Slides", status: "todo", due_date: null }] };

  it("removes deadlines and priorities the user never stated", () => {
    const [proposal] = sanitizeProposals(
      [{ type: "create_tasks", summary: "Add tasks", tasks: [{ title: "Write report", due_date: "2026-11-09", priority: "high" }] }],
      context,
      "I need to write a report",
    );
    expect(proposal.type).toBe("create_tasks");
    if (proposal.type === "create_tasks") {
      expect(proposal.tasks[0].due_date).toBeUndefined();
      expect(proposal.tasks[0].priority).toBeUndefined();
    }
  });

  it("keeps a deadline the user stated", () => {
    const [proposal] = sanitizeProposals(
      [{ type: "create_tasks", summary: "Add", tasks: [{ title: "Report", due_date: "2026-11-09" }] }],
      context,
      "The report is due on November 9",
    );
    expect(proposal.type === "create_tasks" && proposal.tasks[0].due_date).toBe("2026-11-09");
  });

  it("drops unsupported proposal types and unknown task ids", () => {
    const result = sanitizeProposals(
      [
        { type: "run_sql", summary: "x", query: "drop table tasks" },
        { type: "propose_steps", summary: "x", task_id: "11111111-1111-4111-8111-111111111111", steps: ["a"] },
        { type: "suggest_blocks", summary: "x", blocks: [{ block_type: "script" }] },
        { type: "propose_steps", summary: "Steps", task_id: TASK_ID, steps: ["Open the file"] },
      ],
      context,
      "help",
    );
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("propose_steps");
  });
});

describe("assistance levels", () => {
  const steps = [{ done: true }, { done: false }, { done: false }, { done: false }, { done: false }];

  it("shows one step, every step, or a few at a time", () => {
    expect(stepWindow(steps, "one_step")).toEqual({ shown: [steps[1]], doneHidden: 1, laterHidden: 3 });
    expect(stepWindow(steps, "short_list")).toEqual({ shown: steps, doneHidden: 0, laterHidden: 0 });
    expect(stepWindow(steps, "full_overview")).toEqual({ shown: [steps[1], steps[2]], doneHidden: 1, laterHidden: 2 });
    expect(stepWindow(steps, "full_overview", 1).laterHidden).toBe(1);
  });

  it("keeps every saved choice when the level changes", () => {
    expect(normalizePreferences({ planningStyle: "one_step" }).planningStyle).toBe("one_step");
    expect(normalizePreferences({ communicationStyle: "shouting" }).communicationStyle).toBe(DEFAULT_PREFERENCES.communicationStyle);
  });
});

describe("help request proposals", () => {
  const task = { id: TASK_ID, title: "Report", status: "todo", steps: [{ text: "Open the file", done: false }] };
  const raw = [{ type: "propose_steps", summary: "Steps", task_id: TASK_ID, steps: ["open the  FILE", "Write the intro", "Add data", "Check totals", "Send it", "Archive it"] }];
  const steps = (context: Partial<AssistantContext>) => {
    const [proposal] = sanitizeProposals(raw, { mode: "help_me_start", task, ...context }, "help");
    return proposal?.type === "propose_steps" ? proposal : null;
  };
  const at = (planningStyle: string) => ({ responseDetail: "brief" as const, language: "auto", planningStyle });

  it("applies the assistance level and drops steps already on the task", () => {
    expect(steps({ helpRequest: "steps", preferences: at("one_step") })?.steps).toEqual(["Write the intro"]);
    expect(steps({ helpRequest: "steps", preferences: at("short_list") })?.steps).toHaveLength(5);
    expect(steps({ helpRequest: "steps", preferences: at("full_overview") })?.steps).toHaveLength(5);
  });

  it("puts a first action ahead of the written steps, and only for that request", () => {
    expect(steps({ helpRequest: "where_to_begin", preferences: at("full_overview") })).toMatchObject({ steps: ["Write the intro"], insert_first: true });
    expect(steps({ helpRequest: "steps", preferences: at("short_list") })?.insert_first).toBeUndefined();
    expect(steps({})?.insert_first).toBeUndefined();
  });

  it("offers a first action written only in the reply", () => {
    const context: AssistantContext = { mode: "help_me_start", helpRequest: "where_to_begin", task };
    expect(ensureFirstAction([], context, "Open the agenda.")).toMatchObject([{ type: "propose_steps", task_id: TASK_ID, steps: ["Open the agenda."], insert_first: true }]);
    expect(ensureFirstAction([], { ...context, helpRequest: "tired" }, "Take a break.")).toEqual([]);
    expect(ensureFirstAction([], context, "First line.\nSecond line.")).toEqual([]);
  });

  it("keeps a useful suggestion that has no summary", () => {
    const [proposal] = sanitizeProposals([{ type: "propose_steps", task_id: TASK_ID, steps: ["Write the intro"] }], { mode: "chat", task }, "help");
    expect(proposal).toMatchObject({ summary: "Suggested steps", steps: ["Write the intro"] });
  });

  it("ignores a model that tries to set the position itself", () => {
    const [proposal] = sanitizeProposals([{ ...raw[0], insert_first: true }], { mode: "chat", task }, "help");
    expect(proposal.type === "propose_steps" && proposal.insert_first).toBeUndefined();
  });

  it("records missing information only on the selected task", () => {
    const entry = { type: "record_missing_info", summary: "Record", task_id: TASK_ID, missing: "The audience" };
    expect(sanitizeProposals([entry], { mode: "missing_information", task }, "x")).toHaveLength(1);
    expect(sanitizeProposals([entry], { mode: "missing_information", task: null, otherTasks: [{ id: TASK_ID, title: "Report", status: "todo", due_date: null }] }, "x")).toHaveLength(0);
  });

  it("gives each Focus Mode option its own instruction without guessing a cause", () => {
    const text = buildContextText({ mode: "help_me_start", helpRequest: "tired", task });
    expect(text).toContain("short break");
    expect(text).toContain("do not guess at a medical or emotional cause");
    expect(text).not.toContain("you must include one task_plan");
  });

  it("leaves block capabilities out of a button's request", () => {
    expect(buildContextText({ mode: "help_me_start", helpRequest: "tired", task, visibleBlocks: ["notes"] })).not.toContain("Workspace block capabilities");
    expect(buildContextText({ mode: "chat", task, visibleBlocks: ["notes"] })).toContain("Workspace block capabilities");
  });

  it("states the communication style without changing the task", () => {
    const text = buildContextText({ mode: "chat", task, preferences: { ...at("short_list"), communicationStyle: "direct" } });
    expect(text).toContain("no pleasantries");
    expect(text).toContain('"title":"Report"');
  });
});

describe("missing information on a task", () => {
  const entry = (id: string, extra: Partial<CheckIn>): CheckIn => ({
    id,
    user_id: "u",
    kind: "help",
    task_id: TASK_ID,
    completed_text: null,
    next_text: null,
    blocking: id,
    support: "x",
    help_status: "open",
    follow_ups: [],
    created_at: "2026-11-01T00:00:00Z",
    updated_at: "2026-11-01T00:00:00Z",
    ...extra,
  });

  it("separates what still applies from what was resolved", () => {
    const { open, resolved } = taskBlockers(
      [entry("waiting", { help_status: "waiting" }), entry("done", { help_status: "resolved" }), entry("other", { task_id: null }), entry("progress", { kind: "progress" })],
      TASK_ID,
    );
    expect(open.map((item) => item.id)).toEqual(["waiting"]);
    expect(resolved.map((item) => item.id)).toEqual(["done"]);
  });
});

describe("AI failure message", () => {
  it("says work is safe only when that is confirmed", () => {
    expect(aiUnavailableMessage(true)).toBe("MindCraft's AI assistant is temporarily unavailable while we're testing the platform. Your work is safe. Please try again in a moment or continue manually.");
    expect(aiUnavailableMessage(false)).not.toContain("safe");
  });

  it("keeps the specific message for problems a retry cannot fix", () => {
    expect(isTemporaryAiFailure("model_unavailable")).toBe(true);
    expect(isTemporaryAiFailure("rate_limited")).toBe(true);
    expect(isTemporaryAiFailure("ai_disabled_in_demo")).toBe(false);
    expect(isTemporaryAiFailure("unauthenticated")).toBe(false);
  });
});

describe("write confirmation", () => {
  const repoWith = (update: () => Promise<unknown>, insert: () => Promise<unknown> = async () => ({})) => ({ update, insert } as unknown as Repository);

  it("stays unconfirmed until a failed write succeeds", async () => {
    const tracker = createWriteTracker();
    let fail = true;
    const repo = tracker.wrap(repoWith(async () => {
      if (fail) throw new Error("no");
      return {};
    }));
    expect(tracker.isConfirmed()).toBe(true);
    await expect(repo.update("tasks", "1", {})).rejects.toThrow();
    expect(tracker.isConfirmed()).toBe(false);
    fail = false;
    await repo.update("tasks", "1", {});
    expect(tracker.isConfirmed()).toBe(true);
  });

  it("is unconfirmed while a write is running", async () => {
    const tracker = createWriteTracker();
    let finish = () => {};
    const repo = tracker.wrap(repoWith(() => new Promise<void>((resolve) => { finish = resolve; })));
    const pending = repo.update("tasks", "1", {});
    expect(tracker.isConfirmed()).toBe(false);
    finish();
    await pending;
    expect(tracker.isConfirmed()).toBe(true);
  });

  it("treats a duplicate as stored", async () => {
    const tracker = createWriteTracker();
    const repo = tracker.wrap(repoWith(async () => ({}), async () => { throw new RepositoryError("duplicate", "23505"); }));
    await expect(repo.insert("tasks", { id: "1" })).rejects.toThrow();
    expect(tracker.isConfirmed()).toBe(true);
  });
});

describe("assistant declines (acceptance check 9)", () => {
  it("detects a declined timer", () => {
    expect(detectDeclines(["Please, no timer for me."])).toContain("timer");
    expect(detectDeclines(["I don't want to use a timer"])).toContain("timer");
    expect(detectDeclines(["Help me start the slides"])).toEqual([]);
  });

  it("detects Spanish declines", () => {
    expect(detectDeclines(["No me pongas temporizador."])).toContain("timer");
    expect(detectDeclines(["Hoy sin cronómetro"])).toContain("timer");
    expect(detectDeclines(["Prefiero sin descansos"])).toContain("breaks");
    expect(detectDeclines(["No quiero planificación"])).toContain("planning");
    expect(detectDeclines(["Ayúdame a planificar la pausa de la tarde"])).toEqual([]);
  });
});

describe("assistant reply text", () => {
  it("removes inline Markdown markers and keeps lists", () => {
    expect(stripInlineMarkdown("1. **[QA] Task** – vence __hoy__ en `main`\n2. * dos * tres")).toBe("1. [QA] Task – vence hoy en main\n2. * dos * tres");
  });
});

describe("task plans", () => {
  const OTHER_ID = "22222222-2222-4222-8222-222222222222";
  const plan = (extra: Record<string, unknown> = {}, task: Record<string, unknown> = {}) => ({
    type: "task_plan",
    summary: "Plan",
    task: { title: "Draft the report outline", first_action: "Open a blank note", ...task },
    ...extra,
  });
  const context: AssistantContext = { mode: "chat", task: null };
  const single = (raw: unknown, ctx = context, text = "help me") => sanitizeProposals([raw], ctx, text)[0] as Extract<Proposal, { type: "task_plan" }> | undefined;

  it("keeps a valid plan", () => {
    const result = single(plan({ recommended_block: { block_type: "notes", reason: "Rough writing" } }, { estimated_minutes: 30 }));
    expect(result?.recommended_block?.block_type).toBe("notes");
    expect(result?.task.estimated_minutes).toBe(30);
  });

  it("removes a workspace block type that does not exist and keeps the plan", () => {
    const result = single(plan({ recommended_block: { block_type: "ai_chat", reason: "x" }, alternative_block: { block_type: "notes" } }));
    expect(result?.recommended_block?.block_type).toBe("next_step");
    expect(result?.alternative_block).toBeUndefined();
  });

  it("falls back to the Task guide when the model recommends nothing", () => {
    expect(single(plan())?.recommended_block?.block_type).toBe("next_step");
    expect(single(plan({ block_limitation: "No block can send email" }))?.recommended_block).toBeUndefined();
  });

  it("drops an alternative that repeats the primary block", () => {
    expect(single(plan({ recommended_block: { block_type: "notes" }, alternative_block: { block_type: "notes" } }))?.alternative_block).toBeUndefined();
  });

  it.each([0, -5, 601, 12.5, "30"])("removes the invalid duration %s", (minutes) => {
    const result = single(plan({}, { estimated_minutes: minutes }));
    expect(result).toBeDefined();
    expect(result?.task.estimated_minutes).toBeUndefined();
  });

  it("rejects a plan aimed at a task that is not selected", () => {
    expect(single(plan({ task_id: OTHER_ID }))).toBeUndefined();
    const withOther: AssistantContext = { mode: "chat", task: null, otherTasks: [{ id: OTHER_ID, title: "Other", status: "todo", due_date: null }] };
    expect(single(plan({ task_id: OTHER_ID }), withOther)).toBeUndefined();
  });

  it("removes deadlines and priorities the person did not state", () => {
    const result = single(plan({}, { due_date: "2026-11-20", priority: "high" }), context, "help me with this");
    expect(result?.task.due_date).toBeUndefined();
    expect(result?.task.priority).toBeUndefined();
  });

  it("does not let the model claim its own suggestion was stated", () => {
    const result = single(plan({ stated_by_user: ["title", "deliverable"] }, { title: "Draft the quarterly budget", deliverable: "Twelve slide presentation" }), context, "I must draft the quarterly budget");
    expect(result?.stated_by_user).toEqual(["title"]);
  });

  it("flags vague titles", () => {
    expect(isVagueTitle("Work on the project")).toBe(true);
    expect(isVagueTitle("Trabajar en el proyecto")).toBe(true);
    expect(isVagueTitle("Draft the report outline")).toBe(false);
  });

  it("derives the same valid id for the same proposal", async () => {
    const id = await proposalRecordId("message:0");
    expect(id).toBe(await proposalRecordId("message:0"));
    expect(id).not.toBe(await proposalRecordId("message:1"));
    expect(proposalSchema.safeParse(plan({ task_id: id })).success).toBe(true);
  });

  it("finds a task named in a message, preferring the longest title", () => {
    const tasks = [
      { id: "a", title: "Report", status: "todo" as const },
      { id: "b", title: "Report for Ana", status: "todo" as const },
      { id: "c", title: "Finished one", status: "done" as const },
    ];
    expect(findNamedTask("Please plan the report for Ana", tasks)?.id).toBe("b");
    expect(findNamedTask("Plan finished one", tasks)).toBeNull();
  });
});

describe("workspace block capabilities", () => {
  it("covers every block type with real data and limits", () => {
    expect(Object.keys(BLOCK_CAPABILITIES).sort()).toEqual([...BLOCK_ORDER].sort());
    for (const type of BLOCK_ORDER) {
      const capability = BLOCK_CAPABILITIES[type];
      expect(capability.supportedData.length && capability.actions.length && capability.appropriateWhen.length && capability.limits.length).toBeGreaterThan(0);
      expect(capabilityText()).toContain(type);
    }
  });

  it("uses saved blocks, not the model, to decide placement", () => {
    const blocks = [
      { block_type: "notes" as const, hidden: false },
      { block_type: "calendar" as const, hidden: true },
    ];
    expect(blockPlacement(blocks, "notes")).toBe("placed");
    expect(blockPlacement(blocks, "calendar")).toBe("hidden");
    expect(blockPlacement(blocks, "resources")).toBe("available");
  });

  it("tells the model which blocks are placed, hidden, or only in the inventory", () => {
    const text = buildContextText({ mode: "chat", visibleBlocks: ["notes"], hiddenBlocks: ["calendar"] });
    expect(text).toContain('{"type":"notes","placement":"placed"}');
    expect(text).toContain('{"type":"calendar","placement":"hidden"}');
    expect(text).toContain('{"type":"resources","placement":"available"}');
  });
});

describe("saved preferences in the assistant context", () => {
  const preferences = { responseDetail: "brief" as const, language: "auto", planningStyle: "short_list" };

  it("turns each preference into a direct instruction", () => {
    const text = buildContextText({ mode: "chat", preferences: { ...preferences, responseDetail: "detailed", planningStyle: "one_step", taskPresentation: "checklist" } });
    expect(text).toContain("Include the reasoning and an example.");
    expect(text).toContain("Give only the single next action");
    expect(text).toContain("Present actions as a list.");
  });

  it("adds no presentation instruction when none is saved", () => {
    const text = buildContextText({ mode: "chat", preferences: { ...preferences, taskPresentation: "not_set" } });
    expect(text).not.toContain("Present actions as a list.");
    expect(text).not.toContain("Use short paragraphs");
  });
});

describe("task estimates in the task form", () => {
  it("accepts whole minutes only, from 1 to 600", () => {
    expect(taskInputSchema.safeParse({ title: "x", estimated_minutes: 30 }).success).toBe(true);
    expect(taskInputSchema.safeParse({ title: "x", estimated_minutes: null }).success).toBe(true);
    for (const value of [0, 601, 1.5]) expect(taskInputSchema.safeParse({ title: "x", estimated_minutes: value }).success).toBe(false);
  });
});

describe("minimized blocks", () => {
  it("reads the saved flag from the block config", () => {
    expect(isMinimized({ config: { minimized: true } })).toBe(true);
    expect(isMinimized({ config: {} })).toBe(false);
  });

});

describe("chat history sent to the provider", () => {
  const message = (content: string) => ({ role: "user", content });

  it("drops the oldest messages first", () => {
    expect(trimHistory([message("a".repeat(3000)), message("b".repeat(2000)), message("c".repeat(2000))], 4500).map((item) => item.content[0])).toEqual(["b", "c"]);
  });

  it("always keeps the latest message", () => {
    expect(trimHistory([message("a"), message("b".repeat(4000))], 100)).toHaveLength(1);
  });
});

describe("Groq completion reserve", () => {
  it("keeps the prompt and the reserve inside the token limit", () => {
    expect(completionReserve(21000, 8000)).toBe(1437);
    expect(Math.ceil(21000 / 3.2) + completionReserve(21000, 8000)).toBeLessThanOrEqual(8000);
  });

  it("uses a higher limit when one is available and always leaves room to answer", () => {
    expect(completionReserve(21000, 30000)).toBe(3000);
    expect(completionReserve(40000, 8000)).toBe(800);
  });
});

describe("assistant display name", () => {
  it("sends the name as data and asks for it only in the first reply", () => {
    const context: AssistantContext = { mode: "chat", displayName: 'Ana "QA"' };
    expect(buildContextText(context, true)).toContain('"Ana \\"QA\\""');
    expect(buildContextText(context, true)).toContain("first message");
    expect(buildContextText(context)).not.toContain("first message");
    expect(buildContextText({ mode: "chat" }, true)).not.toContain("first message");
  });
});

describe("clearing session data on sign-out", () => {
  it("removes drafts and the focus task but keeps proposal outcomes and appearance", () => {
    const data = new Map([
      ["mindcraft-draft:assistant", "private"],
      ["mindcraft-draft:planning", "private"],
      ["mindcraft-focus-task", "id"],
      ["mindcraft-proposal:message:0", "applied"],
      ["mindcraft-appearance", "{}"],
    ]);
    clearSessionData({
      get length() {
        return data.size;
      },
      key: (index) => [...data.keys()][index] ?? null,
      removeItem: (key) => void data.delete(key),
    });
    expect([...data.keys()]).toEqual(["mindcraft-proposal:message:0", "mindcraft-appearance"]);
  });
});

describe("block catalog", () => {
  it("gives every block a description and an example", () => {
    for (const type of BLOCK_ORDER) {
      expect(catalogItemFor(type).description).toBeTruthy();
      expect(catalogItemFor(type).example).toBeTruthy();
    }
  });

  it("offers every block type exactly once", () => {
    expect(CATALOG_ITEMS.map((item) => item.blockType).sort()).toEqual([...BLOCK_ORDER].sort());
  });
});

describe("preferences", () => {
  it("keeps work style answers and rejects unknown ones", () => {
    const prefs = normalizePreferences({ focusTime: "morning", startHelp: ["clear_steps"] });
    expect(prefs).toMatchObject({ focusTime: "morning", startHelp: ["clear_steps"] });
    expect(normalizePreferences({ startHelp: ["mind_reading"] }).startHelp).toEqual([]);
  });

  it("does not let AI proposals change the running timer", () => {
    const parsed = proposalSchema.safeParse({ type: "suggest_preferences", summary: "x", changes: { timer: DEFAULT_PREFERENCES.timer } });
    expect(parsed.success).toBe(false);
  });

  it("accepts every theme, including ids saved before the palette update", () => {
    for (const theme of THEME_IDS) expect(normalizePreferences({ theme }).theme).toBe(theme);
    expect(THEME_IDS).toEqual(expect.arrayContaining(["clear", "rose", "dark"]));
  });

  it("drops invalid stored values instead of failing", () => {
    const prefs = normalizePreferences({ theme: "neon", textSize: 18, preferredTools: ["notes", "hack"] });
    expect(prefs.theme).toBe("warm-studio");
    expect(prefs.textSize).toBe(18);
    expect(prefs.preferredTools).toEqual([]);
  });
});
