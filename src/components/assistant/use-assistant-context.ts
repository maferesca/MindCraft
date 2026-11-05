"use client";

import { useCallback } from "react";
import { BLOCK_DEFINITIONS } from "@/lib/blocks";
import { detectDeclines } from "@/lib/ai/client";
import type { AssistantContext, HelpRequest } from "@/lib/schemas";
import { workGroups } from "@/lib/groups";
import { stepsForTask, taskBlockOptions, taskBlockers, taskBlocks, tasksForBlock } from "@/lib/task-helpers";
import { useToday } from "../blocks/use-today";
import { useWorkspaceData } from "../providers/workspace-data";

// Builds the minimum context the assistant needs: the selected task, task
// titles for comparison, visible block types, a few preferences, and stated
// choices. It never sends notes, events, or the whole account.
export function useAssistantContext() {
  const { profile, tasks, steps, checkIns, blocks, notes, preferences, messages } = useWorkspaceData();
  const today = useToday();

  return useCallback(
    (mode: AssistantContext["mode"], taskId?: string | null, extraUserText: string[] = [], helpRequest?: HelpRequest, groupId?: string | null): AssistantContext => {
      const task = taskId ? tasks.find((item) => item.id === taskId) : null;
      const userTexts = [...messages.filter((message) => message.role === "user").map((message) => message.content), ...extraUserText];
      const group = groupId ? workGroups(blocks).find((item) => item.id === groupId) : null;
      const groupTasks = group ? taskBlocks(group.members).flatMap((block) => tasksForBlock(tasks, block.id, blocks)) : [];
      const groupTaskIds = new Set(groupTasks.map((item) => item.id));
      const blockOptions = taskBlockOptions(blocks);
      return {
        mode,
        helpRequest,
        taskBlocks: blockOptions.length > 1 ? blockOptions.map((option) => ({ id: option.id, title: option.label.slice(0, 60) })) : undefined,
        group: group
          ? {
              title: group.title,
              blocks: group.members.map((block) => block.title || BLOCK_DEFINITIONS[block.block_type].label),
              tasks: groupTasks.slice(0, 30).map((item) => ({ id: item.id, title: item.title, status: item.status, expected_result: item.expected_result, due_date: item.due_date })),
              // Only notes linked to the group's own tasks, so unrelated notes stay private.
              notes: notes
                .filter((note) => note.task_id && groupTaskIds.has(note.task_id))
                .slice(0, 10)
                .map((note) => ({ title: note.title, body: note.body.slice(0, 500) })),
            }
          : undefined,
        displayName: profile?.display_name?.trim() || null,
        today,
        task: task
          ? {
              id: task.id,
              title: task.title,
              description: task.description,
              expected_result: task.expected_result,
              estimated_minutes: task.estimated_minutes ?? null,
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
        hiddenBlocks: blocks.filter((block) => block.hidden).map((block) => block.block_type),
        preferences: {
          responseDetail: preferences.responseDetail,
          language: preferences.language,
          planningStyle: preferences.planningStyle,
          communicationStyle: preferences.communicationStyle,
          taskPresentation: preferences.taskPresentation,
          focusTime: preferences.focusTime,
          startHelp: preferences.startHelp,
          focusMinutes: preferences.workMinutes,
        },
        declined: detectDeclines(userTexts),
        missingInformation: task
          ? taskBlockers(checkIns, task.id)
              .open.slice(0, 6)
              .map((entry) => (entry.blocking ?? "").slice(0, 300))
          : undefined,
      };
    },
    [profile, tasks, steps, checkIns, blocks, notes, preferences, messages, today],
  );
}
