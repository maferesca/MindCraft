"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cacheAppearance } from "@/lib/appearance-cache";
import { BLOCK_DEFINITIONS, GRID_COLUMNS, findFreePosition, sizeFor } from "@/lib/blocks";
import { createLocalRepository } from "@/lib/data/local-repository";
import type { Repository, Row } from "@/lib/data/repository";
import { createSupabaseRepository } from "@/lib/data/supabase-repository";
import { browserTimezone } from "@/lib/dates";
import { DEFAULT_PREFERENCES, applyPreferencesToDocument, normalizePreferences, type Preferences } from "@/lib/preferences";
import { proposalSchema, type Proposal, type TaskInput } from "@/lib/schemas";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  BlockType,
  CalendarEvent,
  ChatMessage,
  GridPosition,
  Note,
  NotificationPreferences,
  Profile,
  Streak,
  Task,
  TaskStep,
  Workspace,
  WorkspaceBlock,
} from "@/lib/types";
import { useNotify } from "../ui/notifications";

type Status = "loading" | "ready" | "signed_out" | "error";

export interface DeletedTaskSnapshot {
  task: Task;
  steps: TaskStep[];
  linkedNoteIds: string[];
  linkedEventIds: string[];
}

interface WorkspaceData {
  status: Status;
  loadError: string | null;
  mode: Repository["mode"] | null;
  email: string | null;
  profile: Profile | null;
  preferences: Preferences;
  notificationPreferences: NotificationPreferences | null;
  workspace: Workspace | null;
  blocks: WorkspaceBlock[];
  tasks: Task[];
  steps: TaskStep[];
  notes: Note[];
  events: CalendarEvent[];
  messages: ChatMessage[];
  streak: Streak | null;
  previousVisitDate: string | null;

  updatePreferences: (patch: Partial<Preferences>) => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  updateNotificationPreferences: (patch: Partial<NotificationPreferences>) => Promise<void>;
  renameWorkspace: (name: string) => Promise<void>;

  createTask: (input: TaskInput, stepTexts?: string[]) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<DeletedTaskSnapshot | null>;
  restoreTask: (snapshot: DeletedTaskSnapshot) => Promise<void>;
  addStep: (taskId: string, text: string) => Promise<TaskStep | null>;
  updateStep: (id: string, patch: Partial<TaskStep>) => Promise<void>;
  deleteStep: (id: string) => Promise<void>;

  createNote: (input: Partial<Note>) => Promise<Note | null>;
  updateNote: (id: string, patch: Partial<Note>) => Promise<void>;
  deleteNote: (id: string) => Promise<Note | null>;
  restoreNote: (note: Note) => Promise<void>;

  createEvent: (input: Partial<CalendarEvent>) => Promise<CalendarEvent | null>;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;

  saveLayout: (draft: WorkspaceBlock[]) => Promise<boolean>;
  addBlocks: (types: Array<{ type: BlockType; size?: { w: number; h: number } }>) => Promise<void>;
  updateBlockConfig: (id: string, config: Record<string, unknown>) => Promise<void>;
  resetLayout: () => Promise<void>;

  appendMessage: (role: ChatMessage["role"], content: string, proposal?: unknown) => Promise<ChatMessage | null>;
  clearChat: () => Promise<void>;

  applyProposal: (proposal: Proposal) => Promise<string>;
  signOut: () => Promise<void>;
}

const WorkspaceDataContext = createContext<WorkspaceData | null>(null);

export function useWorkspaceData() {
  const value = useContext(WorkspaceDataContext);
  if (!value) throw new Error("useWorkspaceData must be used inside WorkspaceDataProvider");
  return value;
}

function requireRepo(ref: { current: Repository | null }) {
  if (!ref.current) throw new Error("Not signed in");
  return ref.current;
}

// Copies a record without its owner column; the repository sets user_id itself.
function withoutOwner<T extends { user_id: string }>(record: T): Row {
  const copy: Row = { ...record };
  delete copy.user_id;
  return copy;
}

function newLocalId() {
  return `new-${crypto.randomUUID()}`;
}

export function WorkspaceDataProvider({ children }: { children: ReactNode }) {
  const { notify } = useNotify();
  const repoRef = useRef<Repository | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [session, setSession] = useState<{ mode: Repository["mode"]; email: string | null } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [blocks, setBlocks] = useState<WorkspaceBlock[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [previousVisitDate, setPreviousVisitDate] = useState<string | null>(null);

  const reportError = useCallback(
    (error: unknown) => {
      const offline = typeof navigator !== "undefined" && !navigator.onLine;
      notify(offline ? "You're offline, so that change was not saved." : "That change could not be saved. Please try again.", { tone: "error" });
      console.error(error);
    },
    [notify],
  );

  // Initial load: everything the workspace needs, in parallel.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const demo = createLocalRepository();
        const repo = demo ?? (isSupabaseConfigured ? await createSupabaseRepository() : null);
        if (!repo) {
          if (!cancelled) setStatus("signed_out");
          return;
        }
        repoRef.current = repo;
        setSession({ mode: repo.mode, email: repo.email });
        const [profiles, prefRows, notificationRows, workspaces, blockRows, taskRows, stepRows, noteRows, eventRows, conversations] =
          await Promise.all([
            repo.list<Profile>("profiles"),
            repo.list<{ settings: unknown }>("preferences"),
            repo.list<NotificationPreferences>("notification_preferences"),
            repo.list<Workspace>("workspaces"),
            repo.list<WorkspaceBlock>("workspace_blocks"),
            repo.list<Task>("tasks"),
            repo.list<TaskStep>("task_steps"),
            repo.list<Note>("notes"),
            repo.list<CalendarEvent>("calendar_events"),
            repo.list<{ id: string }>("conversations"),
          ]);
        if (cancelled) return;

        let currentProfile = profiles[0] ?? null;
        // Save the browser timezone once so streaks count local calendar days.
        if (currentProfile && currentProfile.timezone === "UTC" && browserTimezone() !== "UTC") {
          currentProfile = await repo.update<Profile>("profiles", repo.userId, { timezone: browserTimezone() });
        }
        const loadedPreferences = normalizePreferences(prefRows[0]?.settings);
        const currentConversation = conversations[0]?.id ?? null;
        const loadedMessages = currentConversation ? await repo.list<ChatMessage>("messages") : [];
        const previous = await repo.getStreak();
        const visit = await repo.recordVisit(currentProfile?.timezone ?? browserTimezone());
        if (cancelled) return;

        setProfile(currentProfile);
        setPreferences(loadedPreferences);
        applyPreferencesToDocument(loadedPreferences);
        cacheAppearance(loadedPreferences);
        setNotificationPreferences(notificationRows[0] ?? null);
        setWorkspace(workspaces[0] ?? null);
        setBlocks(blockRows);
        setTasks(taskRows);
        setSteps(stepRows);
        setNotes(noteRows);
        setEvents(eventRows);
        setConversationId(currentConversation);
        setMessages(loadedMessages);
        setPreviousVisitDate(previous?.last_visit_date ?? null);
        setStreak(visit);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        console.error(error);
        setLoadError(error instanceof Error ? error.message : "Unknown error");
        setStatus("error");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Profile and preferences
  // ---------------------------------------------------------------------------

  const updatePreferences = useCallback(
    async (patch: Partial<Preferences>) => {
      const next = normalizePreferences({ ...preferences, ...patch });
      setPreferences(next);
      applyPreferencesToDocument(next);
      cacheAppearance(next);
      try {
        await requireRepo(repoRef).update("preferences", requireRepo(repoRef).userId, { settings: next });
      } catch (error) {
        reportError(error);
      }
    },
    [preferences, reportError],
  );

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      try {
        const updated = await requireRepo(repoRef).update<Profile>("profiles", requireRepo(repoRef).userId, patch as Row);
        setProfile(updated);
      } catch (error) {
        reportError(error);
      }
    },
    [reportError],
  );

  const updateNotificationPreferences = useCallback(
    async (patch: Partial<NotificationPreferences>) => {
      try {
        const updated = await requireRepo(repoRef).update<NotificationPreferences>("notification_preferences", requireRepo(repoRef).userId, patch as Row);
        setNotificationPreferences(updated);
      } catch (error) {
        reportError(error);
      }
    },
    [reportError],
  );

  const renameWorkspace = useCallback(
    async (name: string) => {
      if (!workspace) return;
      const trimmed = name.trim().slice(0, 60) || "My workspace";
      try {
        const updated = await requireRepo(repoRef).update<Workspace>("workspaces", workspace.id, { name: trimmed });
        setWorkspace(updated);
      } catch (error) {
        reportError(error);
      }
    },
    [workspace, reportError],
  );

  // ---------------------------------------------------------------------------
  // Tasks and steps. Every block reads from these same arrays.
  // ---------------------------------------------------------------------------

  const createTask = useCallback(
    async (input: TaskInput, stepTexts: string[] = []) => {
      try {
        const task = await requireRepo(repoRef).insert<Task>("tasks", { status: "todo", ...input } as Row);
        setTasks((current) => [...current, task]);
        const createdSteps: TaskStep[] = [];
        for (const [index, text] of stepTexts.entries()) {
          createdSteps.push(await requireRepo(repoRef).insert<TaskStep>("task_steps", { task_id: task.id, text, position: index, done: false }));
        }
        if (createdSteps.length) setSteps((current) => [...current, ...createdSteps]);
        return task;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [reportError],
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const before = tasks.find((task) => task.id === id);
      setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
      try {
        const updated = await requireRepo(repoRef).update<Task>("tasks", id, patch as Row);
        setTasks((current) => current.map((task) => (task.id === id ? updated : task)));
      } catch (error) {
        if (before) setTasks((current) => current.map((task) => (task.id === id ? before : task)));
        reportError(error);
      }
    },
    [tasks, reportError],
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const task = tasks.find((item) => item.id === id);
      if (!task) return null;
      const snapshot: DeletedTaskSnapshot = {
        task,
        steps: steps.filter((step) => step.task_id === id),
        linkedNoteIds: notes.filter((note) => note.task_id === id).map((note) => note.id),
        linkedEventIds: events.filter((event) => event.task_id === id).map((event) => event.id),
      };
      try {
        await requireRepo(repoRef).remove("tasks", id);
        setTasks((current) => current.filter((item) => item.id !== id));
        setSteps((current) => current.filter((step) => step.task_id !== id));
        setNotes((current) => current.map((note) => (note.task_id === id ? { ...note, task_id: null } : note)));
        setEvents((current) => current.map((event) => (event.task_id === id ? { ...event, task_id: null } : event)));
        return snapshot;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [tasks, steps, notes, events, reportError],
  );

  // Undo for delete: re-creates the task with the same id and relinks notes/events.
  const restoreTask = useCallback(
    async (snapshot: DeletedTaskSnapshot) => {
      try {
        const task = await requireRepo(repoRef).insert<Task>("tasks", withoutOwner(snapshot.task));
        const restoredSteps: TaskStep[] = [];
        for (const step of snapshot.steps) {
          restoredSteps.push(await requireRepo(repoRef).insert<TaskStep>("task_steps", withoutOwner(step)));
        }
        for (const noteId of snapshot.linkedNoteIds) await requireRepo(repoRef).update("notes", noteId, { task_id: task.id });
        for (const eventId of snapshot.linkedEventIds) await requireRepo(repoRef).update("calendar_events", eventId, { task_id: task.id });
        setTasks((current) => [...current, task]);
        setSteps((current) => [...current, ...restoredSteps]);
        setNotes((current) => current.map((note) => (snapshot.linkedNoteIds.includes(note.id) ? { ...note, task_id: task.id } : note)));
        setEvents((current) =>
          current.map((event) => (snapshot.linkedEventIds.includes(event.id) ? { ...event, task_id: task.id } : event)),
        );
      } catch (error) {
        reportError(error);
      }
    },
    [reportError],
  );

  const addStep = useCallback(
    async (taskId: string, text: string) => {
      const position = steps.filter((step) => step.task_id === taskId).reduce((max, step) => Math.max(max, step.position + 1), 0);
      try {
        const step = await requireRepo(repoRef).insert<TaskStep>("task_steps", { task_id: taskId, text, position, done: false });
        setSteps((current) => [...current, step]);
        return step;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [steps, reportError],
  );

  const updateStep = useCallback(
    async (id: string, patch: Partial<TaskStep>) => {
      const before = steps.find((step) => step.id === id);
      setSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
      try {
        await requireRepo(repoRef).update("task_steps", id, patch as Row);
      } catch (error) {
        if (before) setSteps((current) => current.map((step) => (step.id === id ? before : step)));
        reportError(error);
      }
    },
    [steps, reportError],
  );

  const deleteStep = useCallback(
    async (id: string) => {
      try {
        await requireRepo(repoRef).remove("task_steps", id);
        setSteps((current) => current.filter((step) => step.id !== id));
      } catch (error) {
        reportError(error);
      }
    },
    [reportError],
  );

  // ---------------------------------------------------------------------------
  // Notes and events
  // ---------------------------------------------------------------------------

  const createNote = useCallback(
    async (input: Partial<Note>) => {
      try {
        const note = await requireRepo(repoRef).insert<Note>("notes", { body: "", ...input } as Row);
        setNotes((current) => [note, ...current]);
        return note;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [reportError],
  );

  const updateNote = useCallback(
    async (id: string, patch: Partial<Note>) => {
      setNotes((current) => current.map((note) => (note.id === id ? { ...note, ...patch } : note)));
      try {
        await requireRepo(repoRef).update("notes", id, patch as Row);
      } catch (error) {
        reportError(error);
      }
    },
    [reportError],
  );

  const deleteNote = useCallback(
    async (id: string) => {
      const note = notes.find((item) => item.id === id) ?? null;
      try {
        await requireRepo(repoRef).remove("notes", id);
        setNotes((current) => current.filter((item) => item.id !== id));
        return note;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [notes, reportError],
  );

  const restoreNote = useCallback(
    async (note: Note) => {
      try {
        const restored = await requireRepo(repoRef).insert<Note>("notes", withoutOwner(note));
        setNotes((current) => [restored, ...current]);
      } catch (error) {
        reportError(error);
      }
    },
    [reportError],
  );

  const createEvent = useCallback(
    async (input: Partial<CalendarEvent>) => {
      try {
        const event = await requireRepo(repoRef).insert<CalendarEvent>("calendar_events", input as Row);
        setEvents((current) => [...current, event]);
        return event;
      } catch (error) {
        reportError(error);
        return null;
      }
    },
    [reportError],
  );

  const updateEvent = useCallback(
    async (id: string, patch: Partial<CalendarEvent>) => {
      try {
        const updated = await requireRepo(repoRef).update<CalendarEvent>("calendar_events", id, patch as Row);
        setEvents((current) => current.map((event) => (event.id === id ? updated : event)));
      } catch (error) {
        reportError(error);
      }
    },
    [reportError],
  );

  const deleteEvent = useCallback(
    async (id: string) => {
      try {
        await requireRepo(repoRef).remove("calendar_events", id);
        setEvents((current) => current.filter((event) => event.id !== id));
      } catch (error) {
        reportError(error);
      }
    },
    [reportError],
  );

  // ---------------------------------------------------------------------------
  // Layout. Blocks are presentation only; deleting one never touches content.
  // ---------------------------------------------------------------------------

  // Saves a Creative Mode draft by diffing it against the saved blocks.
  const saveLayout = useCallback(
    async (draft: WorkspaceBlock[]) => {
      if (!workspace) return false;
      try {
        const savedById = new Map(blocks.map((block) => [block.id, block]));
        const draftIds = new Set(draft.map((block) => block.id));
        const result: WorkspaceBlock[] = [];
        for (const block of blocks) {
          if (!draftIds.has(block.id)) await requireRepo(repoRef).remove("workspace_blocks", block.id);
        }
        for (const block of draft) {
          const fields = {
            block_type: block.block_type,
            title: block.title,
            config: block.config,
            layouts: block.layouts,
            mobile_order: block.mobile_order,
            hidden: block.hidden,
          };
          const saved = savedById.get(block.id);
          if (!saved) {
            result.push(await requireRepo(repoRef).insert<WorkspaceBlock>("workspace_blocks", { ...fields, workspace_id: workspace.id }));
          } else if (JSON.stringify({ ...saved, updated_at: "" }) !== JSON.stringify({ ...saved, ...fields, updated_at: "" })) {
            result.push(await requireRepo(repoRef).update<WorkspaceBlock>("workspace_blocks", block.id, fields));
          } else {
            result.push(saved);
          }
        }
        setBlocks(result);
        return true;
      } catch (error) {
        reportError(error);
        return false;
      }
    },
    [blocks, workspace, reportError],
  );

  // Adds blocks directly (used by confirmed proposals and quick-add outside Creative Mode).
  const addBlocks = useCallback(
    async (types: Array<{ type: BlockType; size?: { w: number; h: number } }>) => {
      if (!workspace) return;
      const occupiedLg: GridPosition[] = blocks.filter((block) => !block.hidden && block.layouts.lg).map((block) => block.layouts.lg!);
      const created: WorkspaceBlock[] = [];
      try {
        for (const { type, size } of types) {
          const lgSize = size ?? sizeFor(type, "lg");
          const lg = findFreePosition(occupiedLg, Math.min(lgSize.w, GRID_COLUMNS.lg), lgSize.h, GRID_COLUMNS.lg);
          occupiedLg.push(lg);
          created.push(
            await requireRepo(repoRef).insert<WorkspaceBlock>("workspace_blocks", {
              workspace_id: workspace.id,
              block_type: type,
              title: null,
              config: {},
              layouts: { lg },
              mobile_order: 0,
              hidden: false,
            }),
          );
        }
        setBlocks((current) => [...current, ...created]);
      } catch (error) {
        reportError(error);
      }
    },
    [blocks, workspace, reportError],
  );

  const updateBlockConfig = useCallback(
    async (id: string, config: Record<string, unknown>) => {
      const block = blocks.find((item) => item.id === id);
      if (!block) return;
      const nextConfig = { ...block.config, ...config };
      setBlocks((current) => current.map((item) => (item.id === id ? { ...item, config: nextConfig } : item)));
      try {
        await requireRepo(repoRef).update("workspace_blocks", id, { config: nextConfig });
      } catch (error) {
        reportError(error);
      }
    },
    [blocks, reportError],
  );

  const resetLayout = useCallback(async () => {
    try {
      for (const block of blocks) await requireRepo(repoRef).remove("workspace_blocks", block.id);
      setBlocks([]);
    } catch (error) {
      reportError(error);
    }
  }, [blocks, reportError]);

  // ---------------------------------------------------------------------------
  // Assistant history: one conversation shared by every assistant entry point.
  // ---------------------------------------------------------------------------

  const appendMessage = useCallback(
    async (role: ChatMessage["role"], content: string, proposal?: unknown) => {
      try {
        let id = conversationId;
        if (!id) {
          const conversation = await requireRepo(repoRef).insert<{ id: string }>("conversations", {});
          id = conversation.id;
          setConversationId(id);
        }
        const message = await requireRepo(repoRef).insert<ChatMessage>("messages", {
          conversation_id: id,
          role,
          content: content.slice(0, 8000),
          proposal: proposal ?? null,
        });
        setMessages((current) => [...current, message]);
        return message;
      } catch (error) {
        console.error(error);
        return null;
      }
    },
    [conversationId],
  );

  const clearChat = useCallback(async () => {
    try {
      if (conversationId) await requireRepo(repoRef).remove("conversations", conversationId);
      setConversationId(null);
      setMessages([]);
    } catch (error) {
      reportError(error);
    }
  }, [conversationId, reportError]);

  // ---------------------------------------------------------------------------
  // Applying a reviewed AI proposal. Re-validated here: the app, not the model,
  // decides what is allowed (known task ids, block types, sizes, preference values).
  // ---------------------------------------------------------------------------

  const applyProposal = useCallback(
    async (candidate: Proposal): Promise<string> => {
      const parsed = proposalSchema.safeParse(candidate);
      if (!parsed.success) throw new Error("This suggestion is no longer valid.");
      const proposal = parsed.data;
      switch (proposal.type) {
        case "create_tasks": {
          let count = 0;
          for (const task of proposal.tasks) {
            const created = await createTask(
              {
                title: task.title,
                description: task.description ?? null,
                expected_result: task.expected_result ?? null,
                due_date: task.due_date ?? null,
                priority: task.priority ?? null,
              },
              task.steps ?? [],
            );
            if (created) count += 1;
          }
          return count === 1 ? "Added 1 task." : `Added ${count} tasks.`;
        }
        case "propose_steps": {
          if (!tasks.some((task) => task.id === proposal.task_id)) throw new Error("That task no longer exists.");
          for (const text of proposal.steps) await addStep(proposal.task_id, text);
          return `Added ${proposal.steps.length} steps.`;
        }
        case "suggest_blocks": {
          await addBlocks(proposal.blocks.map((block) => ({ type: block.block_type })));
          return `Added ${proposal.blocks.map((block) => BLOCK_DEFINITIONS[block.block_type].label).join(", ")}.`;
        }
        case "suggest_layout": {
          const sizes = { small: { w: 3, h: 5 }, medium: { w: 4, h: 6 }, large: { w: 6, h: 8 } };
          await addBlocks(
            proposal.items.map((item) => {
              const minimum = BLOCK_DEFINITIONS[item.block_type].minSize;
              const size = sizes[item.size];
              return { type: item.block_type, size: { w: Math.max(size.w, minimum.w), h: Math.max(size.h, minimum.h) } };
            }),
          );
          return "Layout added. You can adjust it in Creative Mode.";
        }
        case "suggest_preferences": {
          await updatePreferences(proposal.changes);
          return "Preferences updated.";
        }
        case "draft_clarification":
          return "Draft ready to copy.";
      }
    },
    [tasks, createTask, addStep, addBlocks, updatePreferences],
  );

  const signOut = useCallback(async () => {
    await repoRef.current?.signOut();
    // A full page load (not client navigation) drops every in-memory record of this account.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/sign-in");
  }, []);

  const value: WorkspaceData = {
    status,
    loadError,
    mode: session?.mode ?? null,
    email: session?.email ?? null,
    profile,
    preferences,
    notificationPreferences,
    workspace,
    blocks,
    tasks,
    steps,
    notes,
    events,
    messages,
    streak,
    previousVisitDate,
    updatePreferences,
    updateProfile,
    updateNotificationPreferences,
    renameWorkspace,
    createTask,
    updateTask,
    deleteTask,
    restoreTask,
    addStep,
    updateStep,
    deleteStep,
    createNote,
    updateNote,
    deleteNote,
    restoreNote,
    createEvent,
    updateEvent,
    deleteEvent,
    saveLayout,
    addBlocks,
    updateBlockConfig,
    resetLayout,
    appendMessage,
    clearChat,
    applyProposal,
    signOut,
  };

  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>;
}

export { newLocalId };
