"use client";

import { useCallback } from "react";
import { detectDeclines } from "@/lib/ai/client";
import type { AssistantContext } from "@/lib/schemas";
import { stepsForTask } from "@/lib/task-helpers";
import { useToday } from "../blocks/use-today";
import { useWorkspaceData } from "../providers/workspace-data";

// Builds the minimum context the assistant needs: the selected task, task
// titles for comparison, visible block types, a few preferences, and stated
// choices. It never sends notes, events, or the whole account.
export function useAssistantContext() {
  const { tasks, steps, blocks, preferences, messages } = useWorkspaceData();
  const today = useToday();

  return useCallback(
    (mode: AssistantContext["mode"], taskId?: string | null, extraUserText: string[] = [], missingInformation?: string[]): AssistantContext => {
      const task = taskId ? tasks.find((item) => item.id === taskId) : null;
      const userTexts = [...messages.filter((message) => message.role === "user").map((message) => message.content), ...extraUserText];
      return {
        mode,
        today,
        task: task
          ? {
              id: task.id,
              title: task.title,
              description: task.description,
              expected_result: task.expected_result,
              due_date: task.due_date,
              priority: task.priority,
              status: task.status,
              steps: stepsForTask(steps, task.id).map((step) => ({ text: step.text, done: step.done })),
            }
          : null,
        otherTasks: tasks
          .filter((item) => item.id !== taskId && item.status !== "done")
          .slice(0, 30)
          .map((item) => ({ id: item.id, title: item.title, status: item.status, due_date: item.due_date })),
        visibleBlocks: blocks.filter((block) => !block.hidden).map((block) => block.block_type),
        preferences: {
          responseDetail: preferences.responseDetail,
          language: preferences.language,
          planningStyle: preferences.planningStyle,
          focusTime: preferences.focusTime,
          startHelp: preferences.startHelp,
          focusMinutes: preferences.workMinutes,
        },
        declined: detectDeclines(userTexts),
        missingInformation,
      };
    },
    [tasks, steps, blocks, preferences, messages, today],
  );
}
