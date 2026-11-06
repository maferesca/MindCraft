"use client";

import { ArrowLeft, CheckSquare, List, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { localDateString } from "@/lib/dates";
import { format, parseISO } from "date-fns";
import { parseNoteLine, toggleNoteLine } from "@/lib/task-helpers";
import type { Note, WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { ChoiceGroup } from "../ui/choice-group";
import { IconButton } from "../ui/icon-button";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";
import { LinkSelect, linkKey, parseLink } from "./link-select";
import { useBlockConfig } from "./use-block-config";
import { useTimezone } from "./use-today";

type TextSize = "small" | "medium" | "large";
const TEXT_SIZES: Record<TextSize, string> = { small: "text-sm", medium: "text-base", large: "text-lg" };

export function noteTitle(note: Pick<Note, "title">) {
  return note.title?.trim() || "Untitled note";
}

export function NotesBlock({ block }: { block: WorkspaceBlock }) {
  const { notes, createNote, updateNote } = useWorkspaceData();
  const timezone = useTimezone();
  const [config, setConfig] = useBlockConfig(block, { noteId: null as string | null, textSize: "medium" as TextSize });
  const openNote = notes.find((note) => note.id === config.noteId);
  const sorted = [...notes].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updated_at.localeCompare(a.updated_at));

  if (openNote) return <NoteEditor key={openNote.id} note={openNote} textSize={config.textSize} onTextSize={(textSize) => setConfig({ textSize })} onBack={() => setConfig({ noteId: null })} />;

  async function newNote() {
    const note = await createNote({ title: null, body: "" });
    if (note) setConfig({ noteId: note.id });
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <button type="button" className="mc-btn mc-btn-primary mc-btn-sm self-start" onClick={newNote}>
        <Plus size={16} aria-hidden="true" /> New note
      </button>
      {sorted.length === 0 ? (
        <p className="mc-hint">No notes yet. Create your first note.</p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-1 overflow-y-auto" aria-label="Notes">
          {sorted.map((note) => (
            <li key={note.id} className="flex items-center gap-1 rounded-lg border border-border hover:bg-surface-muted">
              <button type="button" className="min-w-0 flex-1 px-3 py-2 text-left" onClick={() => setConfig({ noteId: note.id })}>
                <span className="block truncate font-semibold">{noteTitle(note)}</span>
                <span className="mc-hint block">Edited {format(parseISO(localDateString(timezone, new Date(note.updated_at))), "d MMM yyyy")}</span>
              </button>
              <IconButton
                size="sm"
                label={note.pinned ? `Unpin ${noteTitle(note)}` : `Pin ${noteTitle(note)}`}
                aria-pressed={Boolean(note.pinned)}
                icon={note.pinned ? <PinOff size={16} /> : <Pin size={16} />}
                onClick={() => updateNote(note.id, { pinned: !note.pinned })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type SaveState = "saved" | "saving" | "error";

function NoteEditor({ note, textSize, onTextSize, onBack }: { note: Note; textSize: TextSize; onTextSize: (size: TextSize) => void; onBack: () => void }) {
  const { updateNote, deleteNote } = useWorkspaceData();
  const { announce } = useNotify();
  const [title, setTitle] = useState(note.title ?? "");
  const [body, setBody] = useState(note.body);
  const [link, setLink] = useState(linkKey(note));
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [attempt, setAttempt] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">(/^\s*- \[/m.test(note.body) ? "preview" : "edit");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  // Edits still waiting for the autosave delay, kept so leaving cannot drop them.
  const pendingRef = useRef<Partial<Note> | null>(null);

  // Autosave shortly after typing stops.
  useEffect(() => {
    const unchanged = title.trim() === (note.title ?? "") && body === note.body && link === linkKey(note);
    if (unchanged) {
      pendingRef.current = null;
      return;
    }
    const patch = { title: title.trim() || null, body, ...parseLink(link) };
    pendingRef.current = patch;
    const timer = window.setTimeout(async () => {
      pendingRef.current = null;
      setSaveState("saving");
      const ok = await updateNote(note.id, patch);
      setSaveState(ok ? "saved" : "error");
    }, 600);
    return () => window.clearTimeout(timer);
  }, [title, body, link, note, updateNote, attempt]);

  // Saves at once when the editor closes or the page goes away mid-delay.
  useEffect(() => {
    const flush = () => {
      if (!pendingRef.current) return;
      void updateNote(note.id, pendingRef.current);
      pendingRef.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [note.id, updateNote]);

  function insertPrefix(prefix: string) {
    const area = bodyRef.current;
    const position = area?.selectionStart ?? body.length;
    const lineStart = body.lastIndexOf("\n", position - 1) + 1;
    setBody(`${body.slice(0, lineStart)}${prefix}${body.slice(lineStart)}`);
    setMode("edit");
    area?.focus();
  }

  return (
    <div className={`flex h-full flex-col gap-2 ${TEXT_SIZES[textSize]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-base">
        <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" /> All notes
        </button>
        <span className={saveState === "error" ? "mc-error" : "mc-hint"} role="status">
          {saveState === "saving" ? "Saving…" : saveState === "error" ? "Could not save" : "Saved"}
        </span>
        {saveState === "error" ? (
          <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        ) : null}
      </div>
      <label htmlFor={`note-title-${note.id}`} className="sr-only">
        Note title (optional)
      </label>
      <input id={`note-title-${note.id}`} className="mc-input font-semibold" placeholder="Untitled note" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} />
      <div className="flex flex-wrap items-center gap-1 text-base">
        <ChoiceGroup label="Note mode" value={mode} options={[["edit", "Edit"], ["preview", "View"]]} onChange={setMode} />
        <IconButton size="sm" label="Add bullet" icon={<List size={16} />} onClick={() => insertPrefix("- ")} />
        <IconButton size="sm" label="Add checklist item" icon={<CheckSquare size={16} />} onClick={() => insertPrefix("- [ ] ")} />
        <label className="ml-auto text-sm">
          <span className="sr-only">Text size</span>
          <select className="mc-input min-h-9 w-auto py-1" value={textSize} onChange={(event) => onTextSize(event.target.value as TextSize)}>
            <option value="small">Small text</option>
            <option value="medium">Medium text</option>
            <option value="large">Large text</option>
          </select>
        </label>
      </div>
      {mode === "edit" ? (
        <>
          <label htmlFor={`note-body-${note.id}`} className="sr-only">
            Note text
          </label>
          <textarea id={`note-body-${note.id}`} ref={bodyRef} className="mc-input min-h-32 flex-1" maxLength={20000} value={body} onChange={(event) => setBody(event.target.value)} />
        </>
      ) : (
        <NotePreview body={body} onToggle={(index) => setBody(toggleNoteLine(body, index))} />
      )}
      <div className="flex flex-wrap items-end gap-2 text-base">
        <div className="min-w-40 flex-1">
          <LinkSelect value={link} onChange={setLink} />
        </div>
        <button type="button" className="mc-btn mc-btn-danger mc-btn-sm" onClick={() => setConfirmingDelete(true)}>
          <Trash2 size={16} aria-hidden="true" /> Delete
        </button>
      </div>
      <Modal
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title="Delete this note?"
        description="This can't be undone."
        footer={
          <>
            <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setConfirmingDelete(false)}>
              Keep note
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-danger"
              onClick={async () => {
                pendingRef.current = null;
                const deleted = await deleteNote(note.id);
                if (deleted) {
                  announce("Note deleted.");
                  onBack();
                }
                setConfirmingDelete(false);
              }}
            >
              Delete note
            </button>
          </>
        }
      >
        <p className="font-semibold">{noteTitle(note)}</p>
      </Modal>
    </div>
  );
}

// Checkboxes here change only the note's own text, never a task.
function NotePreview({ body, onToggle }: { body: string; onToggle: (index: number) => void }) {
  if (!body.trim()) return <p className="mc-hint flex-1">Nothing written yet.</p>;
  return (
    <div className="min-h-32 flex-1 overflow-y-auto rounded-lg border border-border p-2">
      {body.split("\n").map((line, index) => {
        const parsed = parseNoteLine(line);
        if (parsed.kind === "check") {
          return (
            <label key={index} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" checked={parsed.checked} onChange={() => onToggle(index)} />
              <span className={parsed.checked ? "line-through" : ""}>{parsed.text}</span>
            </label>
          );
        }
        if (parsed.kind === "bullet") {
          return (
            <p key={index} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{parsed.text}</span>
            </p>
          );
        }
        return <p key={index} className="min-h-[1em] whitespace-pre-wrap">{parsed.text}</p>;
      })}
    </div>
  );
}
