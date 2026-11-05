"use client";

import type { ReactNode } from "react";
import { aiUnavailableMessage, isTemporaryAiFailure } from "@/lib/ai/client";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";

interface AiErrorNoticeProps {
  code: string;
  message: string;
  // Whether the person's text is still in the input.
  textKept: boolean;
  children: ReactNode;
}

// "Your work is safe" appears only while every change is confirmed as stored. An
// unsaved Creative Mode layout lives in memory, so it does not count as confirmed.
export function AiErrorNotice({ code, message, textKept, children }: AiErrorNoticeProps) {
  const { workSaved } = useWorkspaceData();
  const { creativeMode } = useWorkspaceUI();
  const temporary = isTemporaryAiFailure(code);
  const confirmed = workSaved && !creativeMode;

  return (
    <div className={`mt-3 rounded-xl border-2 p-3 ${temporary ? "border-border-strong" : "border-danger"}`} role="alert">
      {temporary ? <p className="font-semibold">{aiUnavailableMessage(confirmed)}</p> : <p className="font-semibold text-danger">{message}</p>}
      {temporary && !confirmed ? <p className="mc-hint">Your latest changes are not confirmed as saved yet.</p> : null}
      {textKept ? <p className="mc-hint">Your text is still here.</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
