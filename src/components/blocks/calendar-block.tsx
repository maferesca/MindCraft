"use client";

import { format, parseISO } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Flag, Plus, Timer } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CALENDAR_KIND_LABELS, assignLanes, buildCalendarItems, minuteLabel, visibleDates, type CalendarItem, type CalendarItemKind, type CalendarScale } from "@/lib/calendar";
import { addDaysToDateString, addMonthsToDateString, zonedParts, zonedToIso } from "@/lib/dates";
import { eventInputSchema } from "@/lib/schemas";
import { openTasks } from "@/lib/task-helpers";
import type { CalendarEvent, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { ChoiceGroup } from "../ui/choice-group";
import { SelectField, TextAreaField, TextField } from "../ui/field";
import { IconButton } from "../ui/icon-button";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";
import { useBlockConfig } from "./use-block-config";
import { useTimezone, useToday } from "./use-today";

const HOUR_HEIGHT = 40;
const KIND_ICONS = { deadline: Flag, event: CalendarDays, work_session: Timer };
const KINDS: CalendarItemKind[] = ["deadline", "event", "work_session"];

const dayLabel = (date: string, pattern: string) => format(parseISO(date), pattern);

type Editing = { kind: "event" | "work_session"; event: CalendarEvent | null; date: string };

// The Mindcraft calendar: deadlines, events, and work sessions. All dates display
// in the profile's timezone. It is not connected to Google Calendar or Outlook.
export function CalendarBlock({ block }: { block: WorkspaceBlock }) {
  const { tasks, events, projects } = useWorkspaceData();
  const { openTaskEditor } = useWorkspaceUI();
  const today = useToday();
  const timezone = useTimezone();
  const [config, setConfig] = useBlockConfig(block, {
    view: "calendar" as "calendar" | "agenda",
    scale: "week" as CalendarScale,
    firstDay: 1 as 0 | 1,
    showWeekends: true,
    projectId: "",
    hiddenKinds: [] as CalendarItemKind[],
  });
  const [anchor, setAnchor] = useState(today);
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState<Editing | null>(null);

  const items = buildCalendarItems(tasks, events, timezone, { projectId: config.projectId, hiddenKinds: config.hiddenKinds });
  const agenda = config.view === "agenda";
  const scale: CalendarScale = agenda ? "month" : config.scale;
  const dates = visibleDates(anchor, agenda ? "agenda" : scale, config.firstDay, config.showWeekends);

  function step(direction: 1 | -1) {
    setAnchor((current) => {
      if (scale === "month") return addMonthsToDateString(current, direction);
      return addDaysToDateString(current, direction * (scale === "week" ? 7 : 1));
    });
  }

  function openItem(item: CalendarItem) {
    if (item.kind === "deadline") {
      if (item.taskId) openTaskEditor(item.taskId);
    } else if (item.event) {
      setEditing({ kind: item.kind, event: item.event, date: item.date });
    }
  }

  const rangeLabel =
    scale === "day" ? dayLabel(anchor, "EEEE d MMMM yyyy") : scale === "month" ? dayLabel(anchor, "MMMM yyyy") : `${dayLabel(dates[0], "d MMM")} – ${dayLabel(dates[dates.length - 1], "d MMM yyyy")}`;

  return (
    <div className="flex h-full flex-col gap-2">
      <p className="mc-hint">Mindcraft calendar · not synced</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => setAnchor(today)}>
          Today
        </button>
        <div className="flex items-center">
          <IconButton size="sm" label="Previous" icon={<ChevronLeft size={18} />} onClick={() => step(-1)} />
          <IconButton size="sm" label="Next" icon={<ChevronRight size={18} />} onClick={() => step(1)} />
        </div>
        <ChoiceGroup label="Calendar layout" value={config.view} options={[["calendar", "Calendar"], ["agenda", "Agenda"]]} onChange={(view) => setConfig({ view })} />
        {agenda ? null : <ChoiceGroup label="Calendar range" value={config.scale} options={[["month", "Month"], ["week", "Week"], ["day", "Day"]]} onChange={(next) => setConfig({ scale: next })} />}
        <button type="button" className="mc-btn mc-btn-primary mc-btn-sm ml-auto" onClick={() => setChoosing(true)}>
          <Plus size={16} aria-hidden="true" /> Add
        </button>
      </div>
      <h4 className="font-semibold" aria-live="polite">
        {rangeLabel}
      </h4>

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Options</summary>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label>
            <span className="block font-semibold">First day</span>
            <select className="mc-input min-h-9 w-auto py-1" value={config.firstDay} onChange={(event) => setConfig({ firstDay: Number(event.target.value) as 0 | 1 })}>
              <option value={1}>Monday</option>
              <option value={0}>Sunday</option>
            </select>
          </label>
          <label>
            <span className="block font-semibold">Project</span>
            <select className="mc-input min-h-9 w-auto py-1" value={config.projectId} onChange={(event) => setConfig({ projectId: event.target.value })}>
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-9 items-center gap-2">
            <input type="checkbox" className="h-5 w-5" checked={config.showWeekends} onChange={(event) => setConfig({ showWeekends: event.target.checked })} />
            Weekends
          </label>
          {KINDS.map((kind) => (
            <label key={kind} className="flex min-h-9 items-center gap-2">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={!config.hiddenKinds.includes(kind)}
                onChange={(event) => setConfig({ hiddenKinds: event.target.checked ? config.hiddenKinds.filter((item) => item !== kind) : [...config.hiddenKinds, kind] })}
              />
              {CALENDAR_KIND_LABELS[kind]}
            </label>
          ))}
        </div>
      </details>

      {agenda ? (
        <AgendaView dates={dates} items={items} today={today} onOpen={openItem} />
      ) : scale === "month" ? (
        <MonthView
          dates={dates}
          anchor={anchor}
          columns={config.showWeekends ? 7 : 5}
          items={items}
          today={today}
          onOpen={openItem}
          onOpenDay={(date) => {
            setAnchor(date);
            setConfig({ scale: "day" });
          }}
        />
      ) : (
        <TimeGrid dates={dates} items={items} today={today} onOpen={openItem} />
      )}

      <Modal open={choosing} onOpenChange={setChoosing} title="Add to calendar">
        <div className="grid gap-2 sm:grid-cols-2">
          {(["event", "work_session"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className="mc-btn mc-btn-secondary"
              onClick={() => {
                setChoosing(false);
                setEditing({ kind, event: null, date: anchor });
              }}
            >
              {CALENDAR_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      </Modal>
      {editing ? <EventDialog key={editing.event?.id ?? editing.kind} editing={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function ItemButton({ item, compact, onOpen }: { item: CalendarItem; compact?: boolean; onOpen: (item: CalendarItem) => void }) {
  const Icon = KIND_ICONS[item.kind];
  const styles = {
    deadline: "border-dashed border-border-strong bg-surface",
    event: "border-border bg-primary-soft",
    work_session: "border-secondary bg-surface-muted",
  };
  const time = item.startMinute === null ? "All day" : minuteLabel(item.startMinute);
  return (
    <button
      type="button"
      className={`flex h-full w-full min-w-0 items-start gap-1 overflow-hidden rounded-md border px-1 py-0.5 text-left text-xs leading-tight ${styles[item.kind]}`}
      aria-label={`${CALENDAR_KIND_LABELS[item.kind]}: ${item.title}, ${time}`}
      title={`${CALENDAR_KIND_LABELS[item.kind]}: ${item.title}`}
      onClick={() => onOpen(item)}
    >
      <Icon size={12} aria-hidden="true" className="mt-px shrink-0" />
      <span className="min-w-0">
        {compact ? null : <span className="block font-semibold">{CALENDAR_KIND_LABELS[item.kind]}</span>}
        <span className={compact ? "line-clamp-1" : "line-clamp-2"}>{item.title}</span>
      </span>
    </button>
  );
}

function MonthView({
  dates,
  anchor,
  columns,
  items,
  today,
  onOpen,
  onOpenDay,
}: {
  dates: string[];
  anchor: string;
  columns: number;
  items: CalendarItem[];
  today: string;
  onOpen: (item: CalendarItem) => void;
  onOpenDay: (date: string) => void;
}) {
  return (
    <div className="grid min-h-0 gap-1 overflow-y-auto text-sm" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {dates.slice(0, columns).map((date) => (
        <div key={date} className="text-center font-semibold text-text-muted" aria-hidden="true">
          {dayLabel(date, "EEE")}
        </div>
      ))}
      {dates.map((date) => {
        const dayItems = items.filter((item) => item.date === date);
        return (
          <div key={date} className={`flex min-h-16 min-w-0 flex-col gap-0.5 rounded-md border p-0.5 ${date === today ? "border-2 border-primary" : "border-border"} ${date.slice(0, 7) === anchor.slice(0, 7) ? "" : "opacity-60"}`}>
            <button
              type="button"
              className={`self-start rounded px-1 font-semibold hover:bg-surface-muted ${date === today ? "underline underline-offset-2" : ""}`}
              aria-label={`${date === today ? "Today, " : ""}${dayLabel(date, "EEEE d MMMM")}: ${dayItems.length} items`}
              onClick={() => onOpenDay(date)}
            >
              {dayLabel(date, "d")}
            </button>
            {dayItems.slice(0, 2).map((item) => (
              <ItemButton key={item.key} item={item} compact onOpen={onOpen} />
            ))}
            {dayItems.length > 2 ? (
              <button type="button" className="px-1 text-left text-xs underline" onClick={() => onOpenDay(date)}>
                +{dayItems.length - 2} more
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function TimeGrid({ dates, items, today, onOpen }: { dates: string[]; items: CalendarItem[]; today: string; onOpen: (item: CalendarItem) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const template = `3rem repeat(${dates.length}, minmax(5rem, 1fr))`;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
  }, []);

  return (
    <div ref={scrollRef} className="min-h-40 flex-1 overflow-auto rounded-md border border-border">
      <div className="sticky top-0 z-[2] min-w-fit bg-surface">
        <div className="grid border-b border-border" style={{ gridTemplateColumns: template }}>
          <span />
          {dates.map((date) => (
            <div key={date} className={`px-1 text-center text-sm font-semibold ${date === today ? "underline underline-offset-2" : ""}`}>
              {dayLabel(date, "EEE d")}
              {date === today ? <span className="sr-only"> (today)</span> : null}
            </div>
          ))}
        </div>
        <div className="grid border-b border-border" style={{ gridTemplateColumns: template }}>
          <span className="px-1 text-xs text-text-muted">All day</span>
          {dates.map((date) => (
            <div key={date} className="flex min-h-7 min-w-0 flex-col gap-0.5 border-l border-border p-0.5">
              {items
                .filter((item) => item.date === date && item.startMinute === null)
                .map((item) => (
                  <ItemButton key={item.key} item={item} compact onOpen={onOpen} />
                ))}
            </div>
          ))}
        </div>
      </div>
      <div className="grid min-w-fit" style={{ gridTemplateColumns: template, height: 24 * HOUR_HEIGHT }}>
        <div>
          {Array.from({ length: 24 }).map((_, hour) => (
            <div key={hour} className="border-t border-border px-1 text-xs text-text-muted" style={{ height: HOUR_HEIGHT }}>
              {minuteLabel(hour * 60)}
            </div>
          ))}
        </div>
        {dates.map((date) => {
          const timed = items.filter((item) => item.date === date && item.startMinute !== null);
          const { lanes, count } = assignLanes(timed);
          return (
            <div key={date} className="relative border-l border-border" style={{ backgroundImage: "linear-gradient(to bottom, var(--mc-border) 1px, transparent 1px)", backgroundSize: `100% ${HOUR_HEIGHT}px` }}>
              {timed.map((item) => {
                const start = item.startMinute ?? 0;
                const end = item.endMinute ?? start + 30;
                const lane = lanes.get(item.key) ?? 0;
                return (
                  <div
                    key={item.key}
                    className="absolute p-px"
                    style={{ top: (start / 60) * HOUR_HEIGHT, height: Math.max(((end - start) / 60) * HOUR_HEIGHT, 24), left: `${(lane / count) * 100}%`, width: `${100 / count}%` }}
                  >
                    <ItemButton item={item} onOpen={onOpen} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgendaView({ dates, items, today, onOpen }: { dates: string[]; items: CalendarItem[]; today: string; onOpen: (item: CalendarItem) => void }) {
  const groups = dates.map((date) => ({ date, items: items.filter((item) => item.date === date) })).filter((group) => group.items.length);
  if (!groups.length) return <p className="mc-hint py-2">Nothing scheduled this month. Use Add to create an event or work session.</p>;
  return (
    <ol className="flex min-h-0 flex-col gap-3 overflow-y-auto">
      {groups.map((group) => (
        <li key={group.date}>
          <h5 className="text-sm font-semibold">
            {dayLabel(group.date, "EEEE d MMMM")}
            {group.date === today ? " · Today" : ""}
          </h5>
          <ul className="mt-1 flex flex-col gap-1">
            {group.items.map((item) => (
              <li key={item.key} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-sm tabular-nums">
                  {item.startMinute === null ? "All day" : `${minuteLabel(item.startMinute)}${item.kind === "deadline" ? "" : `–${minuteLabel(item.endMinute ?? item.startMinute)}`}`}
                </span>
                <div className="min-w-0 flex-1">
                  <ItemButton item={item} onOpen={onOpen} />
                </div>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

function EventDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const { tasks, createEvent, updateEvent, deleteEvent } = useWorkspaceData();
  const timezone = useTimezone();
  const { announce } = useNotify();
  const { event, kind } = editing;
  const start = event ? zonedParts(event.starts_at, timezone) : null;
  const end = event ? zonedParts(event.ends_at, timezone) : null;
  const [values, setValues] = useState({
    title: event?.title ?? "",
    date: start?.date ?? editing.date,
    startTime: start?.time ?? "09:00",
    endTime: end?.time ?? "10:00",
    task_id: event?.task_id ?? "",
    notes: event?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (key: keyof typeof values) => (input: { target: { value: string } }) => setValues((current) => ({ ...current, [key]: input.target.value }));
  const session = kind === "work_session";
  const taskOptions = session ? tasks.filter((task) => task.status !== "done" || task.id === event?.task_id) : [];
  const noun = CALENDAR_KIND_LABELS[kind];

  async function handleSubmit(submitEvent: FormEvent) {
    submitEvent.preventDefault();
    if (session && !values.task_id) {
      setErrors({ task_id: "Choose a task" });
      return;
    }
    const parsed = eventInputSchema.safeParse({
      // A session takes its name from the task, which stays the only copy.
      title: session ? "Work session" : values.title,
      kind,
      starts_at: zonedToIso(values.date, values.startTime, timezone),
      ends_at: zonedToIso(values.date, values.endTime, timezone),
      task_id: session ? values.task_id : null,
      notes: session ? null : values.notes,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      return;
    }
    if (event) await updateEvent(event.id, parsed.data);
    else await createEvent(parsed.data);
    announce(`${noun} saved.`);
    onClose();
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()} title={`${event ? "Edit" : "Add"} ${noun.toLowerCase()}`}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        {session ? (
          openTasks(tasks).length || event ? (
            <SelectField label="Task" value={values.task_id} error={errors.task_id} onChange={set("task_id")}>
              <option value="">Choose a task…</option>
              {taskOptions.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </SelectField>
          ) : (
            <p className="mc-error">Add a task first. A work session is always linked to a task.</p>
          )
        ) : (
          <TextField label="Title" value={values.title} onChange={set("title")} error={errors.title} maxLength={200} autoFocus />
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Date" type="date" value={values.date} onChange={set("date")} />
          <TextField label="Start time" type="time" value={values.startTime} onChange={set("startTime")} />
          <TextField label="End time" type="time" value={values.endTime} onChange={set("endTime")} error={errors.ends_at} />
        </div>
        {session ? null : <TextAreaField label="Notes" optional value={values.notes} onChange={set("notes")} maxLength={2000} />}
        <div className="flex flex-wrap justify-between gap-2">
          {event ? (
            <button
              type="button"
              className="mc-btn mc-btn-danger"
              onClick={async () => {
                if (!window.confirm(`Delete this ${noun.toLowerCase()}?`)) return;
                await deleteEvent(event.id);
                announce(`${noun} deleted.`);
                onClose();
              }}
            >
              Delete
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
