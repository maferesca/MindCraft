import { describe, expect, it } from "vitest";
import { sanitizeProposals, stripInlineMarkdown } from "../ai/proposal-guard";
import { detectDeclines } from "../ai/client";
import { CATALOG_ITEMS } from "../block-catalog";
import { BLOCK_ORDER, positionsForBreakpoint, sortForPhone } from "../blocks";
import { clearSessionData } from "../clear-session-data";
import { isWithinQuietHours, nextStreak } from "../dates";
import { moveInOrder } from "../layout-edit";
import { DEFAULT_PREFERENCES, normalizePreferences } from "../preferences";
import { proposalSchema, type AssistantContext } from "../schemas";
import { THEME_IDS } from "../themes";
import type { WorkspaceBlock } from "../types";

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
