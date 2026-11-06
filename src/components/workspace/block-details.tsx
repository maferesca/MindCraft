"use client";

import { Popover } from "radix-ui";
import { Pencil } from "lucide-react";
import { useState, type FormEvent } from "react";
import { BLOCK_DEFINITIONS } from "@/lib/blocks";
import type { WorkspaceBlock } from "@/lib/types";
import { useWorkspaceData } from "../providers/workspace-data";
import { useNotify } from "../ui/notifications";

const savedDescription = (block: WorkspaceBlock) => (typeof block.config.description === "string" ? block.config.description : "");

// Names a block, and describes its purpose when it holds tasks.
export function BlockDetails({ block }: { block: WorkspaceBlock }) {
  const { updateBlockTitle, updateBlockConfig } = useWorkspaceData();
  const { announce } = useNotify();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(block.title ?? "");
  const [description, setDescription] = useState(savedDescription(block));
  const label = BLOCK_DEFINITIONS[block.block_type].label;
  const describes = block.block_type === "task_list";

  async function save(event: FormEvent) {
    event.preventDefault();
    await updateBlockTitle(block.id, title.trim().slice(0, 60) || null);
    if (describes) await updateBlockConfig(block.id, { description: description.trim().slice(0, 300) });
    setOpen(false);
    announce("Block details saved.");
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setTitle(block.title ?? "");
          setDescription(savedDescription(block));
        }
      }}
    >
      <Popover.Trigger className="mc-icon-btn mc-icon-btn-sm" aria-label={`Edit details of ${block.title || label}`} title="Edit details">
        <Pencil size={16} aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="mc-menu w-72 max-w-[calc(100vw-2rem)] p-3" side="bottom" align="end" sideOffset={6} collisionPadding={8}>
          <form onSubmit={save} className="flex flex-col gap-2">
            <label className="text-sm font-semibold">
              Title
              <input className="mc-input mt-1 min-h-9 py-1 font-normal" value={title} maxLength={60} placeholder={label} onChange={(event) => setTitle(event.target.value)} />
            </label>
            {describes ? (
              <label className="text-sm font-semibold">
                Description <span className="font-normal text-text-muted">(optional)</span>
                <textarea className="mc-input mt-1 font-normal" rows={2} value={description} maxLength={300} placeholder="What these tasks are about" onChange={(event) => setDescription(event.target.value)} />
              </label>
            ) : null}
            <button type="submit" className="mc-btn mc-btn-primary mc-btn-sm self-end">
              Save
            </button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
