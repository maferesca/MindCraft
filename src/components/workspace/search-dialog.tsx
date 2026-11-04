"use client";

import { format } from "date-fns";
import { useState } from "react";
import { STATUS_LABELS } from "@/lib/task-helpers";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { Modal } from "../ui/modal";

// "Find something in my workspace": a plain local search, no AI needed.
export function SearchDialog() {
  const { searchOpen, setSearchOpen, openTaskEditor } = useWorkspaceUI();
  const { tasks, notes, events } = useWorkspaceData();
  const [query, setQuery] = useState("");
  const term = query.trim().toLowerCase();
  const match = (...values: Array<string | null | undefined>) => values.some((value) => value?.toLowerCase().includes(term));

  const foundTasks = term ? tasks.filter((task) => match(task.title, task.description, task.expected_result)) : [];
  const foundNotes = term ? notes.filter((note) => match(note.title, note.body)) : [];
  const foundEvents = term ? events.filter((event) => match(event.title, event.notes)) : [];
  const total = foundTasks.length + foundNotes.length + foundEvents.length;

  return (
    <Modal open={searchOpen} onOpenChange={setSearchOpen} title="Find something">
      <label htmlFor="workspace-search" className="sr-only">
        Search
      </label>
      <input id="workspace-search" type="search" className="mc-input" placeholder="Search…" value={query} autoFocus onChange={(event) => setQuery(event.target.value)} />
      <p className="mc-hint mt-2" role="status">
        {term ? `${total} result${total === 1 ? "" : "s"}` : ""}
      </p>
      <div className="mt-2 flex max-h-[50vh] flex-col gap-4 overflow-y-auto">
        {foundTasks.length ? (
          <section>
            <h3 className="font-bold">Tasks</h3>
            <ul>
              {foundTasks.map((task) => (
                <li key={task.id}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-2 text-left hover:bg-surface-muted"
                    onClick={() => {
                      setSearchOpen(false);
                      openTaskEditor(task.id);
                    }}
                  >
                    {task.title} <span className="mc-hint">· {STATUS_LABELS[task.status]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {foundNotes.length ? (
          <section>
            <h3 className="font-bold">Notes</h3>
            <ul className="flex flex-col gap-1">
              {foundNotes.map((note) => (
                <li key={note.id} className="rounded-lg bg-surface-muted px-2 py-2">
                  {note.title ? <span className="block font-semibold">{note.title}</span> : null}
                  <span className="line-clamp-2">{note.body}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {foundEvents.length ? (
          <section>
            <h3 className="font-bold">Calendar</h3>
            <ul>
              {foundEvents.map((event) => (
                <li key={event.id} className="px-2 py-1">
                  {event.title} <span className="mc-hint">· {format(new Date(event.starts_at), "EEE d MMM, HH:mm")}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Modal>
  );
}
