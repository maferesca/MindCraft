"use client";

import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Note, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useNotify } from "../ui/notifications";

// Simple persistent notes with quick capture. No rich text on purpose.
export function NotesBlock({ block }: { block: WorkspaceBlock }) {
  const { notes, createNote } = useWorkspaceData();
  const { announce } = useNotify();
  const [openNoteId, setOpenNoteId] = useState<string | null>(null);
  const [capture, setCapture] = useState("");
  const openNote = notes.find((note) => note.id === openNoteId);
  const sorted = [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  async function handleCapture(event: FormEvent) {
    event.preventDefault();
    const body = capture.trim();
    if (!body) return;
    const note = await createNote({ body: body.slice(0, 20000) });
    if (note) {
      setCapture("");
      announce("Note saved.");
    }
  }

  if (openNote) return <NoteEditor note={openNote} onBack={() => setOpenNoteId(null)} />;

  return (
    <div className="flex h-full flex-col gap-3">
      <form onSubmit={handleCapture} className="flex flex-col gap-2">
        <label htmlFor={`capture-${block.id}`} className="sr-only">
          Quick note
        </label>
        <textarea
          id={`capture-${block.id}`}
          className="mc-input"
          rows={2}
          placeholder="Quick note…"
          value={capture}
          onChange={(event) => setCapture(event.target.value)}
        />
        <div className="flex gap-2">
          <button type="submit" className="mc-btn mc-btn-primary mc-btn-sm">
            Save note
          </button>
          <button
            type="button"
            className="mc-btn mc-btn-secondary mc-btn-sm"
            onClick={async () => {
              const note = await createNote({ title: null, body: "" });
              if (note) setOpenNoteId(note.id);
            }}
          >
            <Plus size={16} aria-hidden="true" /> New note
          </button>
        </div>
      </form>
      {sorted.length === 0 ? (
        <p className="mc-hint">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-1 overflow-y-auto" aria-label="Notes">
          {sorted.map((note) => (
            <li key={note.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-border px-3 py-2 text-left hover:bg-surface-muted"
                onClick={() => setOpenNoteId(note.id)}
              >
                <span className="block font-semibold">{note.title || note.body.split("\n")[0].slice(0, 80) || "Untitled note"}</span>
                {note.title && note.body ? <span className="mc-hint line-clamp-2 block">{note.body}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NoteEditor({ note, onBack }: { note: Note; onBack: () => void }) {
  const { tasks, updateNote, deleteNote, restoreNote } = useWorkspaceData();
  const { notify } = useNotify();
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body);
  const [status, setStatus] = useState<"saved" | "saving">("saved");
  const timer = useRef<number | null>(null);

  // Autosave shortly after typing stops.
  useEffect(() => {
    if (title === (note.title ?? "") && body === note.body) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus("saving");
    timer.current = window.setTimeout(async () => {
      await updateNote(note.id, { title: title.trim() || null, body });
      setStatus("saved");
    }, 700);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [title, body, note.id, note.title, note.body, updateNote]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> All notes
        </button>
        <span className="mc-hint" role="status">
          {status === "saving" ? "Saving…" : "Saved"}
        </span>
      </div>
      <label htmlFor={`note-title-${note.id}`} className="sr-only">
        Note title (optional)
      </label>
      <input
        id={`note-title-${note.id}`}
        className="mc-input font-semibold"
        placeholder="Title (optional)"
        maxLength={200}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label htmlFor={`note-body-${note.id}`} className="sr-only">
        Note text
      </label>
      <textarea
        id={`note-body-${note.id}`}
        className="mc-input min-h-32 flex-1"
        maxLength={20000}
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-40 flex-1 text-sm">
          <span className="block font-semibold">Linked task</span>
          <select className="mc-input" value={note.task_id ?? ""} onChange={(event) => updateNote(note.id, { task_id: event.target.value || null })}>
            <option value="">None</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="mc-btn mc-btn-danger mc-btn-sm"
          onClick={async () => {
            const deleted = await deleteNote(note.id);
            onBack();
            if (deleted) notify("Note deleted.", { action: { label: "Undo", onClick: () => restoreNote(deleted) } });
          }}
        >
          <Trash2 size={16} aria-hidden="true" /> Delete
        </button>
      </div>
    </div>
  );
}
