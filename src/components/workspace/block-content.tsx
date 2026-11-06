"use client";

import type { WorkspaceBlock } from "@/lib/types";
import { CalendarBlock } from "../blocks/calendar-block";
import { CheckInBlock } from "../blocks/check-in-block";
import { FocusTimerBlock } from "../blocks/focus-timer-block";
import { NotesBlock } from "../blocks/notes-block";
import { ResourcesBlock } from "../blocks/resources-block";
import { TaskGuideBlock } from "../blocks/task-guide-block";
import { TaskListBlock } from "../blocks/task-list-block";

// Blocks are views over shared records: they receive only their own display config.
export function BlockContent({ block }: { block: WorkspaceBlock }) {
  switch (block.block_type) {
    case "task_list":
      return <TaskListBlock block={block} />;
    case "calendar":
      return <CalendarBlock block={block} />;
    case "next_step":
      return <TaskGuideBlock block={block} />;
    case "focus_timer":
      return <FocusTimerBlock block={block} />;
    case "notes":
      return <NotesBlock block={block} />;
    case "resources":
      return <ResourcesBlock block={block} />;
    case "check_in":
      return <CheckInBlock />;
  }
}
