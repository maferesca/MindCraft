"use client";

import { DropdownMenu } from "radix-ui";
import { ChevronDown, ChevronUp, GripVertical, Minus, MoreHorizontal, Sparkles, Unlink } from "lucide-react";
import type { WorkGroup } from "@/lib/groups";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { IconButton } from "../ui/icon-button";
import { focusAfterRender } from "./block-frame";

export interface GroupActions {
  rename: (groupId: string, title: string) => void;
  remove: (groupId: string) => void;
  // Phones have no dragging, so a group moves with buttons there.
  movePlace: (groupId: string, direction: -1 | 1) => void;
}

interface GroupHeaderProps {
  group: WorkGroup;
  // Present in Creative Mode, where a group can be edited.
  actions: GroupActions | null;
  draggable: boolean;
}

// The title bar of a work group. In Creative Mode its grip moves the whole group.
export function GroupHeader({ group, actions, draggable }: GroupHeaderProps) {
  const { openAssistant } = useWorkspaceUI();
  const { updateBlockConfig } = useWorkspaceData();

  function minimize() {
    for (const block of group.members) updateBlockConfig(block.id, { groupMinimized: true });
    focusAfterRender(`[data-restore-group="${group.id}"]`);
  }

  return (
    <div className="flex h-full min-w-0 items-center gap-1 px-1">
      {actions && draggable ? (
        <span
          className="mc-drag-handle inline-flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-text-muted hover:bg-background active:cursor-grabbing"
          title="Drag to move the whole group"
          aria-hidden="true"
        >
          <GripVertical size={18} />
        </span>
      ) : null}
      {actions ? (
        <input
          key={group.title}
          aria-label="Group title"
          data-local-escape
          className="mc-input min-h-9 min-w-0 flex-1 py-1 font-bold"
          defaultValue={group.title}
          maxLength={60}
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && value !== group.title) actions.rename(group.id, value);
            else event.target.value = group.title;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
      ) : (
        <h3 className="min-w-0 flex-1 truncate font-bold">{group.title}</h3>
      )}
      {actions && !draggable ? (
        <>
          <IconButton size="sm" className="shrink-0" label={`Move group ${group.title} earlier`} icon={<ChevronUp size={18} />} onClick={() => actions.movePlace(group.id, -1)} />
          <IconButton size="sm" className="shrink-0" label={`Move group ${group.title} later`} icon={<ChevronDown size={18} />} onClick={() => actions.movePlace(group.id, 1)} />
        </>
      ) : null}
      {actions ? (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="mc-icon-btn mc-icon-btn-sm shrink-0" aria-label={`Options for group ${group.title}`} title="Group options">
            <MoreHorizontal size={18} aria-hidden="true" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="mc-menu" align="end" sideOffset={4}>
              <DropdownMenu.Item className="mc-menu-item" onSelect={() => actions.remove(group.id)}>
                <Unlink size={16} aria-hidden="true" /> Remove group, keep blocks
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      ) : (
        <>
          <IconButton size="sm" className="shrink-0" label={`Ask the assistant about ${group.title}`} icon={<Sparkles size={17} />} onClick={() => openAssistant({ mode: "chat", groupId: group.id })} />
          <IconButton size="sm" className="shrink-0" label={`Minimize group ${group.title}`} icon={<Minus size={18} />} data-minimize-group={group.id} onClick={minimize} />
        </>
      )}
    </div>
  );
}
