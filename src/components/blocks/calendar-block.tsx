"use client";

import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight, Flag, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { eventInputSchema } from "@/lib/schemas";
import type { CalendarEvent, Task, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { SelectField, TextAreaField, TextField } from "../ui/field";
import { IconButton } from "../ui/icon-button";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";
import { useToday } from "./use-today";

type View = "day" | "week" | "month";

const dayKey = (date: Date) => format(date, "yyyy-MM-dd");

// The Mindcraft calendar: internal events, work sessions, and task deadlines.
// It is not connected to Google Calendar or Outlook.
export function CalendarBlock({ block }: { block: WorkspaceBlock }) {
  const { events, tasks, updateBlockConfig } = useWorkspaceData();
  const today = useToday();
  const view = (block.config.view as View) ?? "week";
  const [anchor, setAnchor] = useState(() => parseISO(today));
  const [editing, setEditing] = useState<{ event: CalendarEvent | null; date: string } | null>(null);

  const itemsForDay = (date: Date) => {
    const key = dayKey(date);
    return {
      events: events
        .filter((event) => dayKey(new Date(event.starts_at)) === key)
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      deadlines: tasks.filter((task) => task.due_date === key),
    };
  };

  const step = (direction: 1 | -1) =>
    setAnchor((current) => (view === "day" ? addDays(current, direction) : view === "week" ? addWeeks(current, direction) : addMonths(current, direction)));

  const days =
    view === "day"
      ? [anchor]
      : view === "week"
        ? eachDayOfInterval({ start: startOfWeek(anchor, { weekStartsOn: 1 }), end: endOfWeek(anchor, { weekStartsOn: 1 }) })
        : eachDayOfInterval({
            start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
            end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
          });

  const rangeLabel =
    view === "day" ? format(anchor, "EEEE d MMMM") : view === "week" ? `Week of ${format(days[0], "d MMM")}` : format(anchor, "MMMM yyyy");

  return (
    <div className="flex h-full flex-col gap-2">
      <p className="mc-hint -mt-1">Mindcraft calendar · not synced</p>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Calendar view" className="inline-flex rounded-lg border border-border-strong p-0.5">
          {(["day", "week", "month"] as View[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={view === option}
              className={`rounded-md px-3 py-1 text-sm font-semibold capitalize ${view === option ? "bg-primary text-on-primary" : ""}`}
              onClick={() => updateBlockConfig(block.id, { view: option })}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex items-center">
          <IconButton size="sm" label={`Previous ${view}`} icon={<ChevronLeft size={18} />} onClick={() => step(-1)} />
          <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => setAnchor(parseISO(today))}>
            Today
          </button>
          <IconButton size="sm" label={`Next ${view}`} icon={<ChevronRight size={18} />} onClick={() => step(1)} />
        </div>
        <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm ml-auto" onClick={() => setEditing({ event: null, date: dayKey(anchor) })}>
          <Plus size={16} aria-hidden="true" /> Event
        </button>
      </div>
      <h4 className="font-semibold" aria-live="polite">
        {rangeLabel}
      </h4>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-1 overflow-y-auto text-sm">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
            <div key={name} className="text-center font-semibold text-text-muted" aria-hidden="true">
              {name}
            </div>
          ))}
          {days.map((date) => {
            const { events: dayEvents, deadlines } = itemsForDay(date);
            const key = dayKey(date);
            const count = dayEvents.length + deadlines.length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setAnchor(date);
                  updateBlockConfig(block.id, { view: "day" });
                }}
                aria-label={`${key === today ? "Today, " : ""}${format(date, "EEEE d MMMM")}: ${dayEvents.length} events, ${deadlines.length} deadlines`}
                className={`flex min-h-12 flex-col items-start rounded-md border p-1 text-left ${
                  key === today ? "border-2 border-primary" : "border-border"
                } ${isSameMonth(date, anchor) ? "" : "text-text-muted"}`}
              >
                <span className={`font-semibold ${key === today ? "underline underline-offset-2" : ""}`}>{format(date, "d")}</span>
                {count ? <span className="text-xs">{count} item{count > 1 ? "s" : ""}</span> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <ol className="flex flex-col gap-3 overflow-y-auto">
          {days.map((date) => {
            const { events: dayEvents, deadlines } = itemsForDay(date);
            const key = dayKey(date);
            return (
              <li key={key}>
                {view === "week" ? (
                  <h5 className={`text-sm font-semibold ${key === today ? "text-primary" : ""}`}>
                    {format(date, "EEEE d MMM")}
                    {key === today ? " · Today" : ""}
                  </h5>
                ) : null}
                {dayEvents.length + deadlines.length === 0 ? (
                  view === "day" ? <p className="mc-hint text-sm">Nothing planned.</p> : null
                ) : (
                  <ul className="mt-1 flex flex-col gap-1">
                    {deadlines.map((task) => (
                      <DeadlineItem key={task.id} task={task} />
                    ))}
                    {dayEvents.map((event) => (
                      <li key={event.id}>
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 rounded-lg border border-border px-2 py-1 text-left hover:bg-surface-muted"
                          onClick={() => setEditing({ event, date: key })}
                        >
                          <span className="shrink-0 text-sm font-semibold tabular-nums">
                            {format(new Date(event.starts_at), "HH:mm")}–{format(new Date(event.ends_at), "HH:mm")}
                          </span>
                          <span className="min-w-0 flex-1">
                            {event.title}
                            <span className="mc-chip ml-2">{event.kind === "work_session" ? "Work session" : "Event"}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {editing ? <EventDialog event={editing.event} defaultDate={editing.date} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function DeadlineItem({ task }: { task: Task }) {
  const { openTaskEditor } = useWorkspaceUI();
  return (
    <li>
      <button
        type="button"
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border-strong px-2 py-1 text-left hover:bg-surface-muted"
        onClick={() => openTaskEditor(task.id)}
      >
        <Flag size={14} aria-hidden="true" className="shrink-0" />
        <span className="text-sm font-semibold">Deadline:</span>
        <span className={`min-w-0 flex-1 text-sm ${task.status === "done" ? "line-through" : ""}`}>{task.title}</span>
      </button>
    </li>
  );
}

function EventDialog({ event, defaultDate, onClose }: { event: CalendarEvent | null; defaultDate: string; onClose: () => void }) {
  const { tasks, createEvent, updateEvent, deleteEvent } = useWorkspaceData();
  const { announce } = useNotify();
  const start = event ? new Date(event.starts_at) : null;
  const end = event ? new Date(event.ends_at) : null;
  const [values, setValues] = useState({
    title: event?.title ?? "",
    kind: event?.kind ?? "event",
    date: start ? format(start, "yyyy-MM-dd") : defaultDate,
    startTime: start ? format(start, "HH:mm") : "09:00",
    endTime: end ? format(end, "HH:mm") : "10:00",
    task_id: event?.task_id ?? "",
    notes: event?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof values) => (input: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: input.target.value }));

  async function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    const parsed = eventInputSchema.safeParse({
      title: values.title,
      kind: values.kind,
      starts_at: new Date(`${values.date}T${values.startTime}`).toISOString(),
      ends_at: new Date(`${values.date}T${values.endTime}`).toISOString(),
      task_id: values.task_id || null,
      notes: values.notes,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    if (event) await updateEvent(event.id, parsed.data);
    else await createEvent(parsed.data);
    announce(event ? "Event saved." : "Event added to your Mindcraft calendar.");
    onClose();
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={event ? "Edit event" : "New event"}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <TextField label="Title" value={values.title} onChange={set("title")} error={errors.title} maxLength={200} autoFocus />
        <fieldset>
          <legend className="mc-label">Type</legend>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="event" checked={values.kind === "event"} onChange={set("kind")} className="h-5 w-5" /> Event
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="kind" value="work_session" checked={values.kind === "work_session"} onChange={set("kind")} className="h-5 w-5" /> Work session
            </label>
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Date" type="date" value={values.date} onChange={set("date")} />
          <TextField label="Start" type="time" value={values.startTime} onChange={set("startTime")} />
          <TextField label="End" type="time" value={values.endTime} onChange={set("endTime")} error={errors.ends_at} />
        </div>
        <SelectField label="Linked task" optional value={values.task_id} onChange={set("task_id")}>
          <option value="">None</option>
          {tasks.map((task) => (
            <option key={task.id} value={task.id}>
              {task.title}
            </option>
          ))}
        </SelectField>
        <TextAreaField label="Notes" optional value={values.notes} onChange={set("notes")} maxLength={2000} />
        <div className="flex flex-wrap justify-between gap-2">
          {event ? (
            <button
              type="button"
              className="mc-btn mc-btn-danger"
              onClick={async () => {
                if (!window.confirm(`Delete "${event.title}" from your Mindcraft calendar?`)) return;
                await deleteEvent(event.id);
                announce("Event deleted.");
                onClose();
              }}
            >
              Delete event
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" className="mc-btn mc-btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="mc-btn mc-btn-primary">
              Save
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
