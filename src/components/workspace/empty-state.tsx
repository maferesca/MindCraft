"use client";

import { Blocks, CalendarCheck, Compass } from "lucide-react";
import { useState } from "react";
import { BLOCK_DEFINITIONS } from "@/lib/blocks";
import type { BlockType } from "@/lib/types";
import { BlockTile } from "../blocks/block-icon";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { Modal } from "../ui/modal";
import { useNotify } from "../ui/notifications";

// Calm starting point for an empty workspace. Nothing is added automatically:
// a starter layout based on preferences is only shown as a preview.
export function EmptyState() {
  const { preferences, addBlocks } = useWorkspaceData();
  const { setCreativeMode, openPlanning, openAssistant } = useWorkspaceUI();
  const { announce } = useNotify();
  const [previewOpen, setPreviewOpen] = useState(false);
  const suggested: BlockType[] = preferences.preferredTools.length ? preferences.preferredTools : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-16 text-center">
      <div aria-hidden="true" className="mb-6 grid grid-cols-3 gap-2 opacity-90">
        {Array.from({ length: 6 }).map((_, index) => (
          <span
            key={index}
            className={`h-10 w-10 rounded-[10px] border ${index === 4 ? "border-dashed border-primary" : "border-border bg-surface"}`}
            style={index % 2 === 0 && index !== 4 ? { boxShadow: "inset 0 -4px 0 var(--mc-cube-b)" } : undefined}
          />
        ))}
      </div>
      <h2 className="text-3xl font-bold">Your space, your way.</h2>
      <p className="mt-2 text-lg text-text-muted">Add a block or tell us what would help today.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" className="mc-btn mc-btn-primary" onClick={() => setCreativeMode(true)}>
          <Blocks size={18} aria-hidden="true" /> Build my space
        </button>
        <button
          type="button"
          className="mc-btn mc-btn-secondary"
          onClick={() => (suggested.length ? setPreviewOpen(true) : openAssistant({ mode: "chat", message: "Which blocks could help me get organized?", autoSend: false }))}
        >
          <Compass size={18} aria-hidden="true" /> Help me choose
        </button>
        <button type="button" className="mc-btn mc-btn-secondary" onClick={() => openPlanning()}>
          <CalendarCheck size={18} aria-hidden="true" /> Plan my day
        </button>
      </div>

      {suggested.length ? (
        <p className="mc-hint mt-6">
          Starter layout ready.{" "}
          <button type="button" className="font-semibold text-primary underline underline-offset-4" onClick={() => setPreviewOpen(true)}>
            Preview it
          </button>
        </p>
      ) : null}

      <Modal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        title="Starter layout preview"
        description="Nothing is added until you confirm."
        footer={
          <>
            <button type="button" className="mc-btn mc-btn-ghost" onClick={() => setPreviewOpen(false)}>
              Not now
            </button>
            <button type="button" className="mc-btn mc-btn-secondary" onClick={() => { setPreviewOpen(false); setCreativeMode(true); }}>
              Build it myself
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-primary"
              onClick={async () => {
                await addBlocks(suggested.map((type) => ({ type })));
                setPreviewOpen(false);
                announce("Starter layout added.");
              }}
            >
              Add these blocks
            </button>
          </>
        }
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {suggested.map((type) => (
            <li key={type} className="flex items-center gap-3 rounded-xl border border-border p-3 text-left">
              <BlockTile type={type} />
              <span className="font-semibold">{BLOCK_DEFINITIONS[type].label}</span>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}
