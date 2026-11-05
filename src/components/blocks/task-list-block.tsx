"use client";

import { DropdownMenu } from "radix-ui";
import { ArrowRightLeft, CircleHelp, Focus, ListChecks, MessageCircleQuestion, Minimize2, MoreHorizontal, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { PRIORITY_LABELS, STATUS_LABELS, TASK_FILTER_LABELS, filterTasks, formatDeadline, isOverdue, sortTasks, taskBlockIdOf, taskBlockOptions, tasksForBlock, type TaskFilter, type TaskSort } from "@/lib/task-helpers";
import type { Task, TaskStatus, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { ChoiceGroup } from "../ui/choice-group";
import { useNotify } from "../ui/notifications";
import { useBlockConfig } from "./use-block-config";
import { useToday } from "./use-today";

const COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];
const TASK_DRAG_TYPE = "application/x-mindcraft-task";

const EMPTY_TEXT: Record<TaskFilter, string> = {
  all: "No open tasks.",
  today: "Nothing due today.",
  upcoming: "No upcoming deadlines.",
  overdue: "Nothing overdue.",
  completed: "No completed tasks yet.",
};

export function TaskListBlock({ block }: { block: WorkspaceBlock }) {
  const { tasks: allTasks, blocks } = useWorkspaceData();
  const { openTaskEditor } = useWorkspaceUI();
  const today = useToday();
  const [config, setConfig] = useBlockConfig(block, { view: "list" as "list" | "board", filter: "all" as TaskFilter, sort: "deadline" as TaskSort, description: "" });
  const tasks = tasksForBlock(allTasks, block.id, blocks);
  const unsaved = block.id.startsWith("new-");
  const filtered = filterTasks(tasks, config.filter, today);
  // All means incomplete tasks, but the board still needs a working Done column.
  const onBoard = config.view === "board" && config.filter === "all" ? tasks : filtered;
  const visible = sortTasks(onBoard, config.sort);

  return (
    <div className="flex h-full flex-col gap-2">
      {config.description ? <p className="mc-hint whitespace-pre-wrap">{config.description}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" disabled={unsaved} onClick={() => openTaskEditor(null, undefined, block.id)}>
          <Plus size={16} aria-hidden="true" /> Add task
        </button>
        <ChoiceGroup label="Task view" value={config.view} options={[["list", "List"], ["board", "Board"]]} onChange={(view) => setConfig({ view })} />
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`task-filter-${block.id}`}>
          Filter tasks
        </label>
        <select id={`task-filter-${block.id}`} className="mc-input min-h-9 w-auto py-1 text-sm" value={config.filter} onChange={(event) => setConfig({ filter: event.target.value as TaskFilter })}>
          {Object.entries(TASK_FILTER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`task-sort-${block.id}`}>
          Sort tasks
        </label>
        <select id={`task-sort-${block.id}`} className="mc-input min-h-9 w-auto py-1 text-sm" value={config.sort} onChange={(event) => setConfig({ sort: event.target.value as TaskSort })}>
          <option value="deadline">Sort by deadline</option>
          <option value="priority">Sort by priority</option>
          <option value="title">Sort by title</option>
        </select>
      </div>

      {tasks.length === 0 ? (
        <div className="py-2">
          <p className="mc-hint">{unsaved ? "Save the layout to start adding tasks here." : "No tasks here yet. Tasks you add stay in this block."}</p>
        </div>
      ) : config.view === "board" ? (
        <TaskBoard tasks={visible} today={today} />
      ) : visible.length === 0 ? (
        <p className="mc-hint py-2">{EMPTY_TEXT[config.filter]}</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto" aria-label="Tasks">
          {visible.map((task) => (
            <li key={task.id} className="flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-surface-muted">
              <CompletionCheckbox task={task} />
              <div className="min-w-0 flex-1">
                <TaskTitle task={task} />
                <TaskMeta task={task} today={today} />
              </div>
              <TaskMenu task={task} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CompletionCheckbox({ task }: { task: Task }) {
  const { updateTask } = useWorkspaceData();
  const done = task.status === "done";
  return (
    <input
      type="checkbox"
      className="mt-1 h-5 w-5 shrink-0 accent-[var(--mc-primary)]"
      checked={done}
      aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
      onChange={(event) => updateTask(task.id, { status: event.target.checked ? "done" : "todo" })}
    />
  );
}

function TaskTitle({ task }: { task: Task }) {
  const { openTaskEditor } = useWorkspaceUI();
  return (
    <button type="button" className={`text-left font-medium hover:underline ${task.status === "done" ? "text-text-muted line-through" : ""}`} onClick={() => openTaskEditor(task.id)}>
      {task.title}
    </button>
  );
}

function StatusSelect({ task }: { task: Task }) {
  const { updateTask } = useWorkspaceData();
  return (
    <select
      aria-label={`Status of "${task.title}"`}
      className="mc-input min-h-7 w-auto rounded-full px-2 py-0 text-[0.8125rem]"
      value={task.status}
      onChange={(event) => updateTask(task.id, { status: event.target.value as TaskStatus })}
    >
      {COLUMNS.map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </select>
  );
}

function TaskMeta({ task, today }: { task: Task; today: string }) {
  const overdue = isOverdue(task, today);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      <StatusSelect task={task} />
      <span className="mc-chip">Priority: {PRIORITY_LABELS[task.priority ?? "none"]}</span>
      <span className={`mc-chip ${overdue ? "border-danger text-danger" : ""}`}>
        {formatDeadline(task)}
        {overdue ? " (overdue)" : ""}
      </span>
      {task.estimated_minutes ? <span className="mc-chip">About {task.estimated_minutes} min</span> : null}
    </div>
  );
}

function TaskBoard({ tasks, today }: { tasks: Task[]; today: string }) {
  const { updateTask } = useWorkspaceData();
  const { announce } = useNotify();
  const [over, setOver] = useState<TaskStatus | null>(null);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-auto">
      {COLUMNS.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return (
          <section
            key={status}
            aria-label={STATUS_LABELS[status]}
            className={`flex min-h-32 min-w-36 flex-col gap-1.5 rounded-lg border-2 p-1.5 ${over === status ? "border-primary bg-primary-soft" : "border-transparent bg-surface-muted"}`}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes(TASK_DRAG_TYPE)) return;
              event.preventDefault();
              setOver(status);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(event) => {
              setOver(null);
              const id = event.dataTransfer.getData(TASK_DRAG_TYPE);
              if (!id) return;
              event.preventDefault();
              updateTask(id, { status });
              announce(`Task moved to ${STATUS_LABELS[status]}.`);
            }}
          >
            <h4 className="px-1 text-sm font-bold">
              {STATUS_LABELS[status]} <span className="font-normal text-text-muted">{columnTasks.length}</span>
            </h4>
            {columnTasks.map((task) => (
              <article
                key={task.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(TASK_DRAG_TYPE, task.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                className="cursor-grab rounded-lg border border-border bg-surface p-2 active:cursor-grabbing"
              >
                <div className="flex items-start gap-1">
                  <div className="min-w-0 flex-1 text-sm">
                    <TaskTitle task={task} />
                  </div>
                  <TaskMenu task={task} />
                </div>
                <TaskMeta task={task} today={today} />
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function TaskMenu({ task }: { task: Task }) {
  const { deleteTask, restoreTask, updateTask, blocks } = useWorkspaceData();
  const { openAssistant, openMissingInfo, enterFocus } = useWorkspaceUI();
  const { notify } = useNotify();
  const currentBlockId = taskBlockIdOf(task, blocks);
  const destinations = taskBlockOptions(blocks).filter((option) => option.id !== currentBlockId);

  // The same task record keeps its details, steps, and links.
  async function moveTo(option: { id: string; label: string }) {
    if (await updateTask(task.id, { block_id: option.id })) notify(`Moved to ${option.label}.`);
  }

  async function handleDelete() {
    const snapshot = await deleteTask(task.id);
    if (snapshot) notify(`Deleted "${task.title}".`, { action: { label: "Undo", onClick: () => restoreTask(snapshot) } });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="mc-icon-btn mc-icon-btn-sm" aria-label={`Actions for "${task.title}"`} title="Task actions">
        <MoreHorizontal size={18} aria-hidden="true" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="mc-menu" align="end" sideOffset={4}>
          <DropdownMenu.Item className="mc-menu-item" onSelect={() => openAssistant({ mode: "help_me_start", taskId: task.id, autoSend: true })}>
            <Sparkles size={16} aria-hidden="true" /> Help me start
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="mc-menu-item"
            onSelect={() => openAssistant({ mode: "chat", taskId: task.id, autoSend: true, message: `Turn "${task.title}" into a clear plan.` })}
          >
            <ListChecks size={16} aria-hidden="true" /> Make a clear plan
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="mc-menu-item"
            onSelect={() => openAssistant({ mode: "help_me_start", taskId: task.id, autoSend: true, message: `"${task.title}" feels too big. Could you break it down?` })}
          >
            <Minimize2 size={16} aria-hidden="true" /> Break this down
          </DropdownMenu.Item>
          <DropdownMenu.Item
            className="mc-menu-item"
            onSelect={() => openAssistant({ mode: "missing_information", taskId: task.id, autoSend: true, message: `What is missing from "${task.title}"? Draft a question I can edit and send.` })}
          >
            <MessageCircleQuestion size={16} aria-hidden="true" /> Draft a clarifying question
          </DropdownMenu.Item>
          <DropdownMenu.Item className="mc-menu-item" onSelect={() => openMissingInfo(task.id)}>
            <CircleHelp size={16} aria-hidden="true" /> Missing information
          </DropdownMenu.Item>
          <DropdownMenu.Item className="mc-menu-item" onSelect={() => enterFocus(task.id)}>
            <Focus size={16} aria-hidden="true" /> Focus on this task
          </DropdownMenu.Item>
          {destinations.map((option) => (
            <DropdownMenu.Item key={option.id} className="mc-menu-item" onSelect={() => moveTo(option)}>
              <ArrowRightLeft size={16} aria-hidden="true" /> Move to {option.label}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-border" />
          <DropdownMenu.Item className="mc-menu-item text-danger" onSelect={handleDelete}>
            <Trash2 size={16} aria-hidden="true" /> Delete task
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
