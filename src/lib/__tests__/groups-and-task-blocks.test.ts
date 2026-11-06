import { describe, expect, it } from "vitest";
import { buildContextText } from "../ai/assistant-prompt";
import { NO_INVENTED_FIGURES_REPLY, NO_PLAN_REPLY, sanitizeProposals, withoutEmptyPromise, withoutInventedFigures } from "../ai/proposal-guard";
import { DAILY_PHRASES, ENCOURAGEMENT_COOLDOWN_MS, SESSION_PHRASES, TASK_PHRASES, createEncouragementPicker, dailyPhrase } from "../encouragement";
import { isGroupMinimized } from "../blocks";
import { joinGroup, keepGroupsTogether, movePhonePlace, leaveGroup, moveGroup, removeGroup, renameGroup, workGroups } from "../groups";
import { DEFAULT_PREFERENCES, normalizePreferences } from "../preferences";
import { chooseVoice, speechLanguage } from "../speech";
import { STREAK_STAGES, streakStage } from "../streak";
import { THEMES, THEME_IDS } from "../themes";
import { earlyBonus, levelProgress, rewardFeedback } from "../xp";
import type { AssistantContext } from "../schemas";
import { fallbackTaskBlockId, taskBlockOptions, tasksForBlock } from "../task-helpers";
import type { BlockType, Task, WorkspaceBlock } from "../types";

function block(id: string, x: number, y: number, type: BlockType = "notes", extra: Partial<WorkspaceBlock> = {}): WorkspaceBlock {
  return {
    id,
    user_id: "u",
    workspace_id: "w",
    block_type: type,
    title: null,
    config: { keep: id },
    layouts: { lg: { x, y, w: 4, h: 6 } },
    mobile_order: 0,
    hidden: false,
    created_at: `2026-11-0${y % 9 + 1}T00:00:00Z`,
    updated_at: "2026-11-01T00:00:00Z",
    ...extra,
  };
}

const task = (id: string, block_id?: string | null) => ({ id, block_id, status: "todo", title: id }) as Task;

describe("task blocks", () => {
  const first = block("11111111-1111-4111-8111-111111111111", 0, 0, "task_list");
  const second = block("22222222-2222-4222-8222-222222222222", 4, 1, "task_list");
  const blocks = [second, first];

  it("gives each block its own tasks, so a new block starts empty", () => {
    expect(tasksForBlock([task("a", first.id)], second.id, blocks)).toEqual([]);
    expect(tasksForBlock([task("a", second.id)], second.id, blocks).map((item) => item.id)).toEqual(["a"]);
  });

  it("shows tasks with no block in the oldest block, so existing tasks stay visible", () => {
    expect(fallbackTaskBlockId(blocks)).toBe(first.id);
    expect(tasksForBlock([task("a")], first.id, blocks).map((item) => item.id)).toEqual(["a"]);
    expect(tasksForBlock([task("a")], second.id, blocks)).toEqual([]);
  });

  it("keeps a task visible after its block is removed", () => {
    expect(tasksForBlock([task("a", "gone")], first.id, blocks).map((item) => item.id)).toEqual(["a"]);
  });

  it("ignores a block that is not saved yet", () => {
    expect(fallbackTaskBlockId([block("new-1", 0, 0, "task_list")])).toBeNull();
  });

  it("tells apart blocks with the same name", () => {
    expect(taskBlockOptions(blocks).map((option) => option.label)).toEqual(["Tasks", "Tasks 2"]);
  });
});

describe("work groups", () => {
  const blocks = () => [block("a", 0, 0), block("b", 8, 0), block("c", 0, 6)];

  it("starts a group only from an explicit action, and nearby blocks stay apart", () => {
    expect(workGroups(blocks())).toEqual([]);
    const grouped = joinGroup(blocks(), "b", "a", "lg");
    expect(workGroups(grouped)[0].members.map((item) => item.id).sort()).toEqual(["a", "b"]);
    expect(grouped.find((item) => item.id === "c")?.group_id ?? null).toBeNull();
  });

  it("places a joining block beside its target when that space is free", () => {
    const grouped = joinGroup(blocks(), "b", "a", "lg");
    expect(grouped.find((item) => item.id === "b")?.layouts.lg).toMatchObject({ x: 4, y: 0 });
  });

  it("adds to the existing group, so a block belongs to one group only", () => {
    const grouped = joinGroup(joinGroup(blocks(), "b", "a", "lg"), "c", "a", "lg");
    expect(workGroups(grouped)).toHaveLength(1);
    expect(workGroups(grouped)[0].members).toHaveLength(3);
  });

  it("renames every member at once and ignores an empty title", () => {
    const grouped = joinGroup(blocks(), "b", "a", "lg");
    const id = workGroups(grouped)[0].id;
    expect(workGroups(renameGroup(grouped, id, "  Prepare presentation "))[0].title).toBe("Prepare presentation");
    expect(renameGroup(grouped, id, "   ")).toBe(grouped);
  });

  it("moves the whole group and keeps its arrangement", () => {
    const grouped = joinGroup(blocks(), "b", "a", "lg");
    const id = workGroups(grouped)[0].id;
    const moved = moveGroup(grouped, id, 2, 3, "lg");
    const position = (name: string) => moved.find((item) => item.id === name)!.layouts.lg!;
    expect(position("b").x - position("a").x).toBe(4);
    expect(position("a")).toMatchObject({ x: 2, y: 3 });
  });

  it("keeps a moved group on the grid and pushes covered blocks underneath", () => {
    const grouped = joinGroup(blocks(), "b", "a", "lg");
    const moved = moveGroup(grouped, workGroups(grouped)[0].id, 99, 6, "lg");
    expect(moved.find((item) => item.id === "b")!.layouts.lg).toMatchObject({ x: 8, y: 6 });
    expect(moved.find((item) => item.id === "c")!.layouts.lg!.y).toBe(6);
  });

  it("detaches and removes without touching content or position", () => {
    const grouped = joinGroup(blocks(), "b", "a", "lg");
    const detached = leaveGroup(grouped, "b");
    expect(detached.find((item) => item.id === "b")).toMatchObject({ group_id: null, config: { keep: "b" } });
    const removed = removeGroup(grouped, workGroups(grouped)[0].id);
    expect(workGroups(removed)).toEqual([]);
    expect(removed.map((item) => item.layouts.lg)).toEqual(grouped.map((item) => item.layouts.lg));
    expect(removed).toHaveLength(3);
  });

  it("moves a whole group on a phone and passes over a group as one place", () => {
    const phone = [block("x", 0, 0), block("a", 0, 1, "notes", { group_id: "g" }), block("b", 0, 2, "notes", { group_id: "g" }), block("y", 0, 3)];
    const order = (items: WorkspaceBlock[]) => keepGroupsTogether([...items].sort((p, q) => p.mobile_order - q.mobile_order)).map((item) => item.id);
    expect(order(movePhonePlace(phone, "a", -1))).toEqual(["a", "b", "x", "y"]);
    expect(order(movePhonePlace(phone, "b", 1))).toEqual(["x", "y", "a", "b"]);
    expect(order(movePhonePlace(phone, "x", 1))).toEqual(["a", "b", "x", "y"]);
    expect(movePhonePlace(phone, "x", -1)).toBe(phone);
  });

  it("minimizes as a group only while the block is in one", () => {
    expect(isGroupMinimized({ group_id: "g", config: { groupMinimized: true } })).toBe(true);
    expect(isGroupMinimized({ group_id: null, config: { groupMinimized: true } })).toBe(false);
    expect(isGroupMinimized({ group_id: "g", config: { minimized: true } })).toBe(false);
  });

  it("keeps a group's blocks together on a phone", () => {
    const ordered = [block("a", 0, 0, "notes", { group_id: "g" }), block("x", 0, 1), block("b", 0, 2, "notes", { group_id: "g" })];
    expect(keepGroupsTogether(ordered).map((item) => item.id)).toEqual(["a", "b", "x"]);
  });
});

describe("MindCraft Journey", () => {
  it("uses each level's own threshold for progress", () => {
    expect(levelProgress(0)).toMatchObject({ current: { level: 1 }, next: { level: 2 }, percent: 0, toNext: 100 });
    expect(levelProgress(99).current.level).toBe(1);
    expect(levelProgress(100).current.name).toBe("Builder");
    expect(levelProgress(165)).toMatchObject({ current: { level: 2 }, percent: 43, toNext: 85 });
    expect(levelProgress(250).current.name).toBe("Creator");
    expect(levelProgress(500).current.name).toBe("Architect");
    expect(levelProgress(899).current.level).toBe(4);
  });

  it("keeps counting after the highest level", () => {
    expect(levelProgress(900)).toMatchObject({ current: { level: 5, name: "Master Builder" }, next: null, percent: 100, toNext: 0 });
    expect(levelProgress(5000).current.level).toBe(5);
  });

  it("calculates the early bonus with the same rules as the database", () => {
    const hour = 3_600_000;
    expect(earlyBonus(100 * hour, 0, 50 * hour)).toBe(15);
    expect(earlyBonus(100 * hour, 0, 51 * hour)).toBe(10);
    expect(earlyBonus(100 * hour, 0, 80 * hour)).toBe(10);
    expect(earlyBonus(100 * hour, 0, 99 * hour)).toBe(5);
    expect(earlyBonus(100 * hour, 0, 100 * hour)).toBe(0);
    expect(earlyBonus(null, null, 0)).toBe(0);
    expect(earlyBonus(0, 5 * hour, hour)).toBe(0);
    expect(earlyBonus(hour / 2, 0, hour / 4)).toBe(0);
    expect(earlyBonus(5 * hour, 0, hour)).toBe(5);
    expect(earlyBonus(100 * hour, 0, 60_000)).toBe(0);
  });

  it("explains a completed task with its bonus and total", () => {
    const { title, lines } = rewardFeedback([{ action: "early_bonus", amount: 15 }, { action: "task_complete", amount: 20 }]);
    expect(title).toBe("Task completed!");
    expect(lines).toEqual(["+20 XP — Task completion", "+15 XP — Finished ahead of schedule", "Total: +35 XP"]);
  });

  it("keeps rewards visible by default and off without losing other settings", () => {
    expect(DEFAULT_PREFERENCES).toMatchObject({ rewardsEnabled: true, xpNotifications: true, levelUpMessages: true });
    expect(normalizePreferences({ rewardsEnabled: false }).xpNotifications).toBe(true);
  });
});

describe("read aloud voice", () => {
  const voice = (name: string, lang: string) => ({ name, lang, voiceURI: name });
  const voices = [voice("Microsoft Sabina", "es-MX"), voice("Microsoft David", "en-US"), voice("Microsoft Zira", "en-US"), voice("Microsoft Aria Online (Natural)", "en-US"), voice("Google español", "es-ES")];

  it("reads English with an English voice on a Spanish computer", () => {
    expect(chooseVoice(voices, speechLanguage("auto", "Open the sheet and pick the quarter."), "")?.name).toBe("Microsoft Aria Online (Natural)");
  });

  it("reads Spanish with a Spanish voice", () => {
    expect(chooseVoice(voices, speechLanguage("auto", "Abre la hoja de ventas para empezar"), "")?.lang).toMatch(/^es/);
    expect(speechLanguage("Spanish", "Open the sheet")).toBe("es");
  });

  it("uses the chosen voice only for its own language", () => {
    expect(chooseVoice(voices, "en", "Microsoft Zira")?.name).toBe("Microsoft Zira");
    expect(chooseVoice(voices, "es", "Microsoft Zira")?.lang).toMatch(/^es/);
  });

  it("falls back when a chosen voice is not on this computer", () => {
    expect(chooseVoice(voices, "en", "Gone")?.name).toBe("Microsoft Aria Online (Natural)");
    expect(chooseVoice([], "en", "")).toBeNull();
  });
});

describe("streak colors", () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((start) => {
      const c = parseInt(hex.slice(start, start + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };

  it("changes at each stage and stays on the last one", () => {
    expect([1, 2, 3, 6, 7, 13, 14, 29, 30, 99, 100, 900].map((days) => streakStage(days).stage.name)).toEqual(["Orange", "Orange", "Red", "Red", "Pink", "Pink", "Purple", "Purple", "Blue", "Blue", "Gold", "Gold"]);
    expect(streakStage(5).next?.days).toBe(7);
    expect(streakStage(100).next).toBeNull();
  });

  it("is visible on the surface of every theme", () => {
    for (const id of THEME_IDS) {
      if (id === "monochrome") continue;
      const { dark, tokens } = THEMES[id];
      for (const stage of STREAK_STAGES) {
        expect(contrast(dark ? stage.dark : stage.light, tokens.surface), `${stage.name} on ${id}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("timer preferences", () => {
  it("keeps saved sessions and falls back when they are invalid", () => {
    const session = { ...DEFAULT_PREFERENCES.timer, runState: "paused" as const };
    expect(normalizePreferences({ timerSessions: { one: session } }).timerSessions.one.runState).toBe("paused");
    expect(normalizePreferences({ timerSessions: { one: { runState: "broken" } } }).timerSessions).toEqual({});
  });

  it("turns motivational messages off and keeps that choice", () => {
    expect(DEFAULT_PREFERENCES.motivationalMessages).toBe(true);
    expect(normalizePreferences({ motivationalMessages: false }).motivationalMessages).toBe(false);
  });
});

describe("daily phrase", () => {
  it("stays the same during a day and comes from the local list", () => {
    expect(dailyPhrase("2026-11-05")).toBe(dailyPhrase("2026-11-05"));
    expect(DAILY_PHRASES).toContain(dailyPhrase("2026-11-05"));
  });

  it("never repeats yesterday's phrase, including across months and years", () => {
    const day = new Date("2026-01-01T00:00:00Z");
    for (let i = 0; i < 800; i += 1) {
      const today = day.toISOString().slice(0, 10);
      day.setUTCDate(day.getUTCDate() + 1);
      expect(dailyPhrase(day.toISOString().slice(0, 10))).not.toBe(dailyPhrase(today));
    }
  });
});

describe("progress encouragement", () => {
  it("shows one message for several completions in a row", () => {
    const picker = createEncouragementPicker();
    expect(picker.next("task", 1000)).toBe(TASK_PHRASES[0]);
    expect(picker.next("task", 1500)).toBeNull();
    expect(picker.next("session", 2000)).toBeNull();
  });

  it("uses different phrases for tasks and sessions, and takes turns", () => {
    const picker = createEncouragementPicker();
    const later = ENCOURAGEMENT_COOLDOWN_MS + 1;
    expect(picker.next("task", 0)).toBe(TASK_PHRASES[0]);
    expect(picker.next("session", later)).toBe(SESSION_PHRASES[0]);
    expect(picker.next("task", later * 2)).toBe(TASK_PHRASES[1]);
    expect(picker.next("session", later * 3)).toBe(SESSION_PHRASES[1]);
    expect(TASK_PHRASES.some((phrase) => (SESSION_PHRASES as readonly string[]).includes(phrase))).toBe(false);
  });
});

describe("assistant with task blocks and groups", () => {
  const TASK = "6f1c2c7e-6a43-4e0a-9d1b-2f6c2c1a9b10";
  const BLOCK = "7f1c2c7e-6a43-4e0a-9d1b-2f6c2c1a9b11";
  const group = { title: "Launch", blocks: ["Tasks"], tasks: [{ id: TASK, title: "Draft plan", status: "todo" }], notes: [] };

  it("only moves a known task to a known block", () => {
    const move = { type: "move_task", summary: "Move", task_id: TASK, task_block_id: BLOCK };
    const context: AssistantContext = { mode: "chat", group, taskBlocks: [{ id: BLOCK, title: "Launch" }] };
    expect(sanitizeProposals([move], context, "move it")).toHaveLength(1);
    expect(sanitizeProposals([move], { mode: "chat", group }, "move it")).toHaveLength(0);
    expect(sanitizeProposals([move], { mode: "chat", taskBlocks: context.taskBlocks }, "move it")).toHaveLength(0);
  });

  it("drops an unknown task block from a plan and keeps the plan", () => {
    const plan = { type: "task_plan", summary: "Plan", task_block_id: BLOCK, task: { title: "Draft the plan", first_action: "Open the file" } };
    const [kept] = sanitizeProposals([plan], { mode: "chat" }, "draft the plan");
    expect(kept.type === "task_plan" && kept.task_block_id).toBeUndefined();
  });

  it("replaces a reply built on figures nobody supplied", () => {
    expect(withoutInventedFigures("Revenue was $1,245,000, up 12%.", "Summarize Q3 sales")).toBe(NO_INVENTED_FIGURES_REPLY);
  });

  it("keeps figures the person gave, and ordinary replies", () => {
    expect(withoutInventedFigures("Revenue was $1,245,000, up 12%.", "Q3 revenue was 1,245,000 and grew 12%")).toContain("$1,245,000");
    expect(withoutInventedFigures("Open the sheet and spend 25 minutes on it.", "Plan this")).toContain("Open the sheet");
  });

  it("never announces a plan it does not include", () => {
    expect(withoutEmptyPromise("Here is a plan for the summary.", [])).toBe(NO_PLAN_REPLY);
    expect(withoutEmptyPromise("Which plan do you mean?", [], "Which plan?")).toContain("Which plan");
  });

  it("keeps a plan that has no summary", () => {
    const [kept] = sanitizeProposals([{ type: "task_plan", task: { title: "Draft the plan", first_action: "Open the file" } }], { mode: "chat" }, "draft the plan");
    expect(kept?.summary).toBe("Draft the plan");
  });

  it("sends group content only when the person opened the group", () => {
    expect(buildContextText({ mode: "chat", group })).toContain("work group");
    expect(buildContextText({ mode: "chat" })).not.toContain("work group");
  });
});
