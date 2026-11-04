"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { IconButton } from "../ui/icon-button";

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
  position: number;
}

interface ChecklistEditorProps {
  items: ChecklistItem[];
  noun: string;
  onAdd: (text: string) => void;
  onChange: (id: string, patch: { text?: string; done?: boolean; position?: number }) => void;
  onDelete: (id: string) => void;
}

// Shared by steps and review criteria, which are stored separately. A new row
// is only saved once it has text.
export function ChecklistEditor({ items, noun, onAdd, onChange, onDelete }: ChecklistEditorProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");

  function saveNew() {
    const value = text.trim();
    if (value) onAdd(value);
    setText("");
    setAdding(false);
  }

  function move(index: number, direction: -1 | 1) {
    const reordered = [...items];
    [reordered[index], reordered[index + direction]] = [reordered[index + direction], reordered[index]];
    reordered.forEach((item, position) => {
      if (item.position !== position) onChange(item.id, { position });
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {items.length ? (
        <ol className="flex flex-col gap-1">
          {items.map((item, index) => (
            <li key={item.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                className="h-5 w-5 shrink-0 accent-[var(--mc-primary)]"
                checked={item.done}
                aria-label={`${item.done ? "Uncheck" : "Check"} ${noun} ${index + 1}`}
                onChange={(event) => onChange(item.id, { done: event.target.checked })}
              />
              <input
                key={item.text}
                aria-label={`${noun} ${index + 1} text`}
                className={`mc-input min-h-9 min-w-0 flex-1 py-1 ${item.done ? "text-text-muted line-through" : ""}`}
                defaultValue={item.text}
                maxLength={500}
                onBlur={(event) => {
                  const value = event.target.value.trim();
                  if (value && value !== item.text) onChange(item.id, { text: value });
                  else event.target.value = item.text;
                }}
              />
              <IconButton size="sm" label={`Move ${noun} ${index + 1} up`} icon={<ArrowUp size={15} />} disabled={index === 0} onClick={() => move(index, -1)} />
              <IconButton size="sm" label={`Move ${noun} ${index + 1} down`} icon={<ArrowDown size={15} />} disabled={index === items.length - 1} onClick={() => move(index, 1)} />
              <IconButton size="sm" label={`Delete ${noun} ${index + 1}`} icon={<Trash2 size={15} />} onClick={() => onDelete(item.id)} />
            </li>
          ))}
        </ol>
      ) : null}
      {adding ? (
        <input
          autoFocus
          aria-label={`New ${noun}`}
          placeholder={`Write the ${noun}…`}
          className="mc-input min-h-9 py-1"
          maxLength={500}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onBlur={saveNew}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveNew();
              setAdding(true);
            }
            if (event.key === "Escape") {
              event.stopPropagation();
              setText("");
              setAdding(false);
            }
          }}
        />
      ) : (
        <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm self-start" onClick={() => setAdding(true)}>
          <Plus size={14} aria-hidden="true" /> Add {noun}
        </button>
      )}
    </div>
  );
}
