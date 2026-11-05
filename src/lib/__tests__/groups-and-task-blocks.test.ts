import { describe, expect, it } from "vitest";
import { buildContextText } from "../ai/assistant-prompt";
import { NO_INVENTED_FIGURES_REPLY, NO_PLAN_REPLY, sanitizeProposals, withoutEmptyPromise, withoutInventedFigures } from "../ai/proposal-guard";
import { DAILY_PHRASES, dailyPhrase } from "../encouragement";
import { joinGroup, keepGroupsTogether, leaveGroup, moveGroup, removeGroup, renameGroup, workGroups } from "../groups";
import { DEFAULT_PREFERENCES, normalizePreferences } from "../preferences";
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

  it("keeps a group's blocks together on a phone", () => {
    const ordered = [block("a", 0, 0, "notes", { group_id: "g" }), block("x", 0, 1), block("b", 0, 2, "notes", { group_id: "g" })];
    expect(keepGroupsTogether(ordered).map((item) => item.id)).toEqual(["a", "b", "x"]);
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
