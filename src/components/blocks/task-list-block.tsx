"use client";

import { DropdownMenu } from "radix-ui";
import { CircleHelp, Focus, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { addDaysToDateString } from "@/lib/dates";
import { taskInputSchema } from "@/lib/schemas";
import { PRIORITY_LABELS, STATUS_LABELS, formatDueDate, isOverdue, stepsForTask } from "@/lib/task-helpers";
import type { Task, TaskStatus, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { useNotify } from "../ui/notifications";
import { useToday } from "./use-today";

type StatusFilter = "all" | "open" | TaskStatus;
type DateFilter = "any" | "overdue" | "today" | "week" | "none";

export function TaskListBlock({ block }: { block: WorkspaceBlock }) {
  const { tasks, steps, createTask, updateBlockConfig } = useWorkspaceData();
  const today = useToday();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { announce } = useNotify();

  const statusFilter = (block.config.statusFilter as StatusFilter) ?? "open";
  const dateFilter = (block.config.dateFilter as DateFilter) ?? "any";
  const expanded = block.config.view === "expanded";
  const weekEnd = addDaysToDateString(today, 7);

  const visible = tasks
    .filter((task) => {
      if (statusFilter === "open" && task.status === "done") return false;
      if (statusFilter !== "all" && statusFilter !== "open" && task.status !== statusFilter) return false;
      if (dateFilter === "overdue") return isOverdue(task, today);
      if (dateFilter === "today") return task.due_date === today;
      if (dateFilter === "week") return Boolean(task.due_date && task.due_date >= today && task.due_date <= weekEnd);
      if (dateFilter === "none") return !task.due_date;
      return true;
    })
    .sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || a.created_at.localeCompare(b.created_at));

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    const parsed = taskInputSchema.safeParse({ title });
    if (!parsed.success) {
      setError("Write a title for the task.");
      return;
    }
    setError(null);
    const created = await createTask(parsed.data);
    if (created) {
      setTitle("");
      announce(`Task added: ${created.title}`);
    }
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <form onSubmit={handleAdd} className="flex gap-2" noValidate>
        <label htmlFor={`quick-task-${block.id}`} className="sr-only">
          New task title
        </label>
        <input
          id={`quick-task-${block.id}`}
          className="mc-input"
          placeholder="Add a task…"
          value={title}
          maxLength={200}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `quick-task-error-${block.id}` : undefined}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit" className="mc-btn mc-btn-primary shrink-0" aria-label="Add task">
          <Plus size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Add</span>
        </button>
      </form>
      {error ? (
        <p id={`quick-task-error-${block.id}`} className="mc-error">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor={`status-filter-${block.id}`}>
          Filter by status
        </label>
        <select
          id={`status-filter-${block.id}`}
          className="mc-input w-auto min-h-9 py-1 text-sm"
          value={statusFilter}
          onChange={(event) => updateBlockConfig(block.id, { statusFilter: event.target.value })}
        >
          <option value="open">Not done</option>
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`date-filter-${block.id}`}>
          Filter by date
        </label>
        <select
          id={`date-filter-${block.id}`}
          className="mc-input w-auto min-h-9 py-1 text-sm"
          value={dateFilter}
          onChange={(event) => updateBlockConfig(block.id, { dateFilter: event.target.value })}
        >
          <option value="any">Any date</option>
          <option value="overdue">Past deadline</option>
          <option value="today">Due today</option>
          <option value="week">Due within 7 days</option>
          <option value="none">No deadline</option>
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="mc-hint py-2">
          {tasks.length === 0 ? "No tasks yet. Add one above; a title is enough." : "No tasks match these filters."}
        </p>
      ) : (
        <ul className="-mx-1 flex flex-col gap-1 overflow-y-auto px-1" aria-label="Tasks">
          {visible.map((task) => (
            <TaskRow key={task.id} task={task} expanded={expanded} today={today} stepCount={stepsForTask(steps, task.id).length} />
          ))}
        </ul>
      )}
    </div>
  );
}

function TaskRow({ task, expanded, today, stepCount }: { task: Task; expanded: boolean; today: string; stepCount: number }) {
  const { updateTask, deleteTask, restoreTask } = useWorkspaceData();
  const { openTaskEditor, openAssistant, openMissingInfo, enterFocus } = useWorkspaceUI();
  const { notify } = useNotify();
  const done = task.status === "done";
  const overdue = isOverdue(task, today);

  async function handleDelete() {
    const snapshot = await deleteTask(task.id);
    if (snapshot) {
      notify(`Deleted "${task.title}".`, { action: { label: "Undo", onClick: () => restoreTask(snapshot) } });
    }
  }

  return (
    <li className="group flex items-start gap-2 rounded-lg px-1 py-1.5 hover:bg-surface-muted">
      <input
        type="checkbox"
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--mc-primary)]"
        checked={done}
        aria-label={done ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
        onChange={(event) => updateTask(task.id, { status: event.target.checked ? "done" : "todo" })}
      />
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className={`text-left font-medium hover:underline ${done ? "text-text-muted line-through" : ""}`}
          onClick={() => openTaskEditor(task.id)}
        >
          {task.title}
        </button>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {task.status !== "todo" && task.status !== "done" ? (
            <span className={`mc-chip ${task.status === "blocked" ? "border-danger text-danger" : ""}`}>{STATUS_LABELS[task.status]}</span>
          ) : null}
          {task.due_date ? (
            <span className={`mc-chip ${overdue ? "border-danger text-danger" : ""}`}>
              {formatDueDate(task.due_date)}
              {overdue ? " (passed)" : ""}
            </span>
          ) : null}
          {task.priority ? <span className="mc-chip">{PRIORITY_LABELS[task.priority]}</span> : null}
          {expanded && stepCount ? <span className="mc-chip">{stepCount} steps</span> : null}
        </div>
        {expanded && task.description ? <p className="mc-hint mt-1 line-clamp-3">{task.description}</p> : null}
        {expanded && task.expected_result ? (
          <p className="mt-1 text-sm">
            <span className="font-semibold">Expected result:</span> {task.expected_result}
          </p>
        ) : null}
      </div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger className="mc-icon-btn mc-icon-btn-sm" aria-label={`Actions for "${task.title}"`} title="Task actions">
          <MoreHorizontal size={18} aria-hidden="true" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content className="mc-menu" align="end" sideOffset={4}>
            <DropdownMenu.Item className="mc-menu-item" onSelect={() => openAssistant({ mode: "help_me_start", taskId: task.id, autoSend: true })}>
              <Sparkles size={16} aria-hidden="true" /> Help me start
            </DropdownMenu.Item>
            <DropdownMenu.Item className="mc-menu-item" onSelect={() => openMissingInfo(task.id)}>
              <CircleHelp size={16} aria-hidden="true" /> Missing information
            </DropdownMenu.Item>
            <DropdownMenu.Item className="mc-menu-item" onSelect={() => enterFocus(task.id)}>
              <Focus size={16} aria-hidden="true" /> Focus on this task
            </DropdownMenu.Item>
            <DropdownMenu.Item className="mc-menu-item" onSelect={() => openTaskEditor(task.id)}>
              <Pencil size={16} aria-hidden="true" /> Edit details
            </DropdownMenu.Item>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger className="mc-menu-item">Set status</DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent className="mc-menu">
                  <DropdownMenu.RadioGroup value={task.status} onValueChange={(value) => updateTask(task.id, { status: value as TaskStatus })}>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <DropdownMenu.RadioItem key={value} value={value} className="mc-menu-item">
                        <span className="inline-block w-4" aria-hidden="true">
                          {task.status === value ? "✓" : ""}
                        </span>
                        {label}
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.SubContent>
              </DropdownMenu.Portal>
            </DropdownMenu.Sub>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item className="mc-menu-item text-danger" onSelect={handleDelete}>
              <Trash2 size={16} aria-hidden="true" /> Delete task
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </li>
  );
}
