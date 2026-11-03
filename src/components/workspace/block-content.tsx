"use client";

import type { WorkspaceBlock } from "@/lib/types";
import { CalendarBlock } from "../blocks/calendar-block";
import { FocusTimerBlock } from "../blocks/focus-timer-block";
import { NextStepBlock } from "../blocks/next-step-block";
import { NotesBlock } from "../blocks/notes-block";
import { TaskListBlock } from "../blocks/task-list-block";

// Blocks are views over shared records: they receive only their own display config.
export function BlockContent({ block }: { block: WorkspaceBlock }) {
  switch (block.block_type) {
    case "task_list":
      return <TaskListBlock block={block} />;
    case "calendar":
      return <CalendarBlock block={block} />;
    case "next_step":
      return <NextStepBlock block={block} />;
    case "focus_timer":
      return <FocusTimerBlock />;
    case "notes":
      return <NotesBlock block={block} />;
  }
}
