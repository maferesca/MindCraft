"use client";

import { DropdownMenu } from "radix-ui";
import { Loader2, MessageCircle, MoreHorizontal, RotateCcw, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { askAssistant } from "@/lib/ai/client";
import { proposalSchema, type Proposal } from "@/lib/schemas";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI, type AssistantMode } from "../providers/workspace-ui";
import { IconButton } from "../ui/icon-button";
import { restoreFocus } from "../ui/restore-focus";
import { ProposalCard } from "./proposal-card";
import { RateLimitNotice } from "./rate-limit-notice";
import { useAssistantContext } from "./use-assistant-context";
import { useLocalDraft } from "./use-local-draft";
import { VoiceRecorder } from "./voice-recorder";

function proposalsFrom(value: unknown): Proposal[] {
  const list = (value as { proposals?: unknown[] } | null)?.proposals;
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const parsed = proposalSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

// Below the lg breakpoint the panel covers the screen, so the page behind it
// must not receive focus. On wider screens it sits beside the workspace.
function keepTabInFullScreenPanel(event: KeyboardEvent<HTMLElement>) {
  if (!window.matchMedia("(max-width: 63.99rem)").matches) return;
  const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), textarea, input, a[href]")];
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function AssistantButton() {
  const { assistantOpen, openAssistant, closeAssistant, creativeMode } = useWorkspaceUI();
  // In Creative Mode the assistant moves into the inventory dock so it never covers blocks.
  if (creativeMode) return null;
  return (
    <button
      type="button"
      onClick={() => (assistantOpen ? closeAssistant() : openAssistant())}
      aria-expanded={assistantOpen}
      aria-controls="assistant-panel"
      className={`mc-btn mc-btn-primary fixed bottom-4 right-4 z-40 h-14 rounded-full px-5 shadow-lg sm:bottom-6 sm:right-6 ${assistantOpen ? "max-lg:hidden" : ""}`}
    >
      <MessageCircle size={20} aria-hidden="true" />
      <span>Assistant</span>
    </button>
  );
}

// One contextual assistant shared by chat, Daily Planning, Help me start,
// and Missing information, with a single saved conversation.
export function AssistantPanel() {
  const { messages, tasks, appendMessage, clearChat } = useWorkspaceData();
  const { assistantOpen, assistantRequest, consumeAssistantRequest, closeAssistant, openSettings } = useWorkspaceUI();
  const buildContext = useAssistantContext();
  const [input, setInput] = useLocalDraft("assistant");
  const [mode, setMode] = useState<AssistantMode>("chat");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const sendingRef = useRef(false);
  // Retain a received answer if saving fails, so retry saves it without making
  // another AI request or adding the already-saved user message again.
  const unsavedReplyRef = useRef<{
    text: string;
    mode: AssistantMode;
    taskId: string | null;
    reply: string;
    proposal: unknown;
    userSaved: boolean;
  } | null>(null);
  const [error, setError] = useState<{ message: string; text: string; rateLimited?: boolean } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const task = taskId ? tasks.find((item) => item.id === taskId) : null;

  async function send(text: string, sendMode: AssistantMode = mode, sendTaskId: string | null = taskId) {
    const content = text.trim();
    if (!content || sendingRef.current) return;
    sendingRef.current = true;
    setPending(true);
    setError(null);
    let savingReply = false;
    try {
      let exchange = unsavedReplyRef.current;
      if (!exchange || exchange.text !== content || exchange.mode !== sendMode || exchange.taskId !== sendTaskId) {
        const history = messages.slice(-10).map((message) => ({ role: message.role, content: message.content }));
        const result = await askAssistant([...history, { role: "user", content }], buildContext(sendMode, sendTaskId, [content]));
        if (!result.ok) {
          setError({ message: result.message, text: content, rateLimited: result.code === "rate_limited" });
          setInput((current) => current || content);
          return;
        }
        exchange = {
          text: content,
          mode: sendMode,
          taskId: sendTaskId,
          reply: result.data.question ? `${result.data.reply}\n\n${result.data.question}` : result.data.reply,
          proposal: result.data.proposals.length ? { proposals: result.data.proposals } : null,
          userSaved: false,
        };
        unsavedReplyRef.current = exchange;
      }
      savingReply = true;
      if (!exchange.userSaved) {
        const savedUser = await appendMessage("user", content);
        if (!savedUser) throw new Error("User message was not saved.");
        exchange.userSaved = true;
      }
      const savedReply = await appendMessage("assistant", exchange.reply, exchange.proposal);
      if (!savedReply) throw new Error("Assistant reply was not saved.");
      unsavedReplyRef.current = null;
      setInput((current) => (current.trim() === content ? "" : current));
    } catch {
      setInput((current) => current || content);
      setError({
        message: savingReply
          ? "The assistant replied, but the conversation could not be saved. Try again to save it."
          : "The assistant could not answer. Please try again.",
        text: content,
      });
    } finally {
      sendingRef.current = false;
      setPending(false);
    }
  }

  // Requests from other parts of the app (Help me start, Missing information…).
  useEffect(() => {
    if (!assistantOpen || !assistantRequest) return;
    const request = assistantRequest;
    consumeAssistantRequest();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(request.mode);
    setTaskId(request.taskId ?? null);
    const requestTask = request.taskId ? tasks.find((item) => item.id === request.taskId) : null;
    const message =
      request.message ?? (request.mode === "help_me_start" && requestTask ? `Help me start "${requestTask.title}".` : "");
    if (request.autoSend && message) send(message, request.mode, request.taskId ?? null);
    else if (message) setInput(message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantOpen, assistantRequest]);

  useEffect(() => {
    if (!assistantOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => restoreFocus(opener);
  }, [assistantOpen]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length, pending, assistantOpen]);

  if (!assistantOpen) return null;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  return (
    <aside
      id="assistant-panel"
      aria-label="Assistant"
      className="fixed inset-0 z-50 flex flex-col bg-surface lg:inset-auto lg:bottom-4 lg:right-4 lg:top-[calc(var(--header-height)+0.5rem)] lg:w-[26rem] lg:rounded-2xl lg:border lg:border-border lg:shadow-2xl"
      onKeyDown={(event) => {
        // Portaled menus bubble here through React, but Escape belongs to them.
        if (event.key === "Escape" && event.currentTarget.contains(event.target as Node)) closeAssistant();
        if (event.key === "Tab") keepTabInFullScreenPanel(event);
      }}
    >
      <header className="flex items-center gap-2 border-b border-border px-4 py-2">
        <h2 className="flex-1 text-lg font-bold">Assistant</h2>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger className="mc-icon-btn mc-icon-btn-sm" aria-label="Assistant options" title="Assistant options">
            <MoreHorizontal size={18} aria-hidden="true" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="mc-menu z-[60]" align="end" sideOffset={4}>
              <DropdownMenu.Item className="mc-menu-item" onSelect={() => openSettings("ai")}>
                What is sent to the AI
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="mc-menu-item text-danger"
                disabled={pending}
                onSelect={() => {
                  if (window.confirm("Clear the whole chat history? This cannot be undone.")) {
                    unsavedReplyRef.current = null;
                    setError(null);
                    clearChat();
                  }
                }}
              >
                Clear chat history
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <IconButton size="sm" label="Close assistant" icon={<X size={18} />} onClick={closeAssistant} />
      </header>

      {task ? (
        <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-4 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">
            About: <span className="font-semibold">{task.title}</span>
          </span>
          <button
            type="button"
            className="mc-btn mc-btn-ghost mc-btn-sm"
            onClick={() => {
              setTaskId(null);
              setMode("chat");
            }}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 && !pending ? (
          <p className="mc-hint">Ask for help planning or getting started.</p>
        ) : null}
        <ol className="flex flex-col gap-3">
          {messages.map((message) => (
            <li key={message.id} className={message.role === "user" ? "self-end" : "self-start"}>
              <div
                className={`max-w-[22rem] whitespace-pre-wrap rounded-2xl px-3 py-2 ${
                  message.role === "user" ? "bg-primary-soft" : "border border-border bg-background"
                }`}
              >
                <span className="sr-only">{message.role === "user" ? "You said:" : "Assistant:"}</span>
                {message.content}
              </div>
              {message.role === "assistant"
                ? proposalsFrom(message.proposal).map((proposal, index) => (
                    <div key={index} className="mt-2 max-w-[22rem]">
                      <ProposalCard proposal={proposal} storageKey={`${message.id}:${index}`} />
                    </div>
                  ))
                : null}
            </li>
          ))}
        </ol>
        {pending ? (
          <p className="mt-3 inline-flex items-center gap-2 text-text-muted" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Thinking…
          </p>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-xl border-2 border-danger p-3" role="alert">
            {error.rateLimited ? (
              <RateLimitNotice messageKept={input.trim() === error.text} />
            ) : (
              <>
                <p className="font-semibold text-danger">{error.message}</p>
                <p className="mc-hint">Your message is kept below.</p>
              </>
            )}
            <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm mt-2" onClick={() => send(error.text)}>
              <RotateCcw size={14} aria-hidden="true" /> Try again
            </button>
          </div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 border-t border-border p-3">
        <label htmlFor="assistant-input" className="sr-only">
          Message to the assistant
        </label>
        <textarea
          id="assistant-input"
          ref={inputRef}
          className="mc-input"
          rows={2}
          maxLength={4000}
          placeholder="Write a message…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              send(input);
            }
          }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VoiceRecorder disabled={pending} onTranscript={(text) => setInput((current) => (current ? `${current} ${text}` : text))} />
          <button type="submit" className="mc-btn mc-btn-primary mc-btn-sm ml-auto" disabled={pending || !input.trim()}>
            <Send size={14} aria-hidden="true" /> Send
          </button>
        </div>
      </form>
    </aside>
  );
}
