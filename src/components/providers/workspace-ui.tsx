"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { HelpRequest } from "@/lib/schemas";

export type SettingsSection = "profile" | "appearance" | "workspace" | "notifications" | "ai" | "account";
export type AssistantMode = "chat" | "help_me_start" | "planning" | "missing_information";

export interface AssistantRequest {
  mode: AssistantMode;
  taskId?: string | null;
  message?: string;
  autoSend?: boolean;
  helpRequest?: HelpRequest;
}

interface WorkspaceUI {
  creativeMode: boolean;
  setCreativeMode: (value: boolean) => void;
  focusTaskId: string | null;
  focusMode: boolean;
  enterFocus: (taskId?: string | null) => void;
  exitFocus: () => void;
  setFocusTaskId: (taskId: string | null) => void;

  assistantOpen: boolean;
  assistantRequest: AssistantRequest | null;
  openAssistant: (request?: AssistantRequest) => void;
  closeAssistant: () => void;
  consumeAssistantRequest: () => void;

  settings: SettingsSection | null;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;

  planningOpen: boolean;
  planningPrefill: string;
  openPlanning: (prefill?: string) => void;
  closePlanning: () => void;

  taskEditor: { taskId: string | null; title?: string } | null;
  openTaskEditor: (taskId: string | null, title?: string) => void;
  closeTaskEditor: () => void;

  missingInfo: { taskId: string; entryId: string | null } | null;
  // With an entry id, the form edits that entry instead of adding one.
  openMissingInfo: (taskId: string, entryId?: string) => void;
  closeMissingInfo: () => void;

  guideStep: number | null;
  setGuideStep: (step: number | null) => void;

  searchOpen: boolean;
  setSearchOpen: (value: boolean) => void;
}

const WorkspaceUIContext = createContext<WorkspaceUI | null>(null);
const FOCUS_TASK_KEY = "mindcraft-focus-task";

// Screen-level state: which mode and which dialog is open. Kept separate from
// data so entering Focus Mode or Creative Mode never changes saved records.
export function WorkspaceUIProvider({ children }: { children: ReactNode }) {
  const [creativeMode, setCreativeMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [focusTaskId, setFocusTaskIdState] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantRequest, setAssistantRequest] = useState<AssistantRequest | null>(null);
  const [settings, setSettings] = useState<SettingsSection | null>(null);
  const [planningOpen, setPlanningOpen] = useState(false);
  const [planningPrefill, setPlanningPrefill] = useState("");
  const [taskEditor, setTaskEditor] = useState<{ taskId: string | null; title?: string } | null>(null);
  const [missingInfo, setMissingInfo] = useState<{ taskId: string; entryId: string | null } | null>(null);
  const [guideStep, setGuideStep] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    try {
      // Restoring a per-device convenience after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFocusTaskIdState(window.localStorage.getItem(FOCUS_TASK_KEY));
    } catch {
      // Storage unavailable.
    }
  }, []);

  const setFocusTaskId = useCallback((taskId: string | null) => {
    setFocusTaskIdState(taskId);
    try {
      if (taskId) window.localStorage.setItem(FOCUS_TASK_KEY, taskId);
      else window.localStorage.removeItem(FOCUS_TASK_KEY);
    } catch {
      // Storage unavailable.
    }
  }, []);

  const value: WorkspaceUI = {
    creativeMode,
    setCreativeMode: (next) => {
      if (next) setFocusMode(false);
      setCreativeMode(next);
    },
    focusTaskId,
    focusMode,
    enterFocus: (taskId) => {
      if (taskId !== undefined) setFocusTaskId(taskId);
      setCreativeMode(false);
      setFocusMode(true);
      window.scrollTo({ top: 0 });
    },
    exitFocus: () => setFocusMode(false),
    setFocusTaskId,

    assistantOpen,
    assistantRequest,
    openAssistant: (request) => {
      setAssistantRequest(request ?? null);
      setAssistantOpen(true);
    },
    closeAssistant: () => setAssistantOpen(false),
    consumeAssistantRequest: () => setAssistantRequest(null),

    settings,
    openSettings: (section = "appearance") => setSettings(section),
    closeSettings: () => setSettings(null),

    planningOpen,
    planningPrefill,
    openPlanning: (prefill = "") => {
      setPlanningPrefill(prefill);
      setPlanningOpen(true);
    },
    closePlanning: () => setPlanningOpen(false),

    taskEditor,
    openTaskEditor: (taskId, title) => setTaskEditor({ taskId, title }),
    closeTaskEditor: () => setTaskEditor(null),

    missingInfo,
    openMissingInfo: (taskId, entryId) => setMissingInfo({ taskId, entryId: entryId ?? null }),
    closeMissingInfo: () => setMissingInfo(null),

    guideStep,
    setGuideStep,

    searchOpen,
    setSearchOpen,
  };

  return <WorkspaceUIContext.Provider value={value}>{children}</WorkspaceUIContext.Provider>;
}

export function useWorkspaceUI() {
  const value = useContext(WorkspaceUIContext);
  if (!value) throw new Error("useWorkspaceUI must be used inside WorkspaceUIProvider");
  return value;
}
