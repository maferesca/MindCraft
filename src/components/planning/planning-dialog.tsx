"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { askAssistant } from "@/lib/ai/client";
import type { AssistantResult } from "@/lib/schemas";
import { ProposalCard } from "../assistant/proposal-card";
import { useAssistantContext } from "../assistant/use-assistant-context";
import { useLocalDraft } from "../assistant/use-local-draft";
import { VoiceRecorder } from "../assistant/voice-recorder";
import { useWorkspaceData } from "../providers/workspace-data";
import { useWorkspaceUI } from "../providers/workspace-ui";
import { Modal } from "../ui/modal";

// Daily planning: describe today by text or voice, then review suggestions.
// Unspecified deadlines, priorities, and times stay empty.
export function PlanningDialog() {
  const { planningOpen, planningPrefill, closePlanning, openTaskEditor } = useWorkspaceUI();
  const { messages, appendMessage } = useWorkspaceData();
  const buildContext = useAssistantContext();
  const [text, setText] = useLocalDraft("planning");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ data: AssistantResult; key: string } | null>(null);
  const autoSubmitted = useRef<string | null>(null);

  async function submit(content: string) {
    const message = content.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    setResult(null);
    const history = messages.slice(-6).map((item) => ({ role: item.role, content: item.content }));
    const response = await askAssistant([...history, { role: "user", content: message }], buildContext("planning", null, [message]));
    setPending(false);
    if (!response.ok) {
      setError(response.message);
      return;
    }
    await appendMessage("user", message);
    const reply = response.data.question ? `${response.data.reply}\n\n${response.data.question}` : response.data.reply;
    const saved = await appendMessage("assistant", reply, response.data.proposals.length ? { proposals: response.data.proposals } : null);
    setResult({ data: response.data, key: saved?.id ?? `planning-${Date.now()}` });
    setText("");
  }

  useEffect(() => {
    if (planningOpen && planningPrefill && autoSubmitted.current !== planningPrefill) {
      autoSubmitted.current = planningPrefill;
      setText(planningPrefill);
      submit(planningPrefill);
    }
    if (!planningOpen) autoSubmitted.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planningOpen, planningPrefill]);

  function close() {
    setResult(null);
    setError(null);
    closePlanning();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit(text);
  }

  return (
    <Modal open={planningOpen} onOpenChange={(open) => !open && close()} title="Plan my day" description="Describe what's on your mind. You'll review every suggestion before anything changes." wide>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="planning-text" className="mc-label">
          What do you have in mind today?
        </label>
        <textarea
          id="planning-text"
          className="mc-input"
          rows={4}
          maxLength={4000}
          placeholder="For example: I need to finish the slides for Thursday and prepare for a meeting."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <VoiceRecorder disabled={pending} onTranscript={(transcript) => setText((current) => (current ? `${current} ${transcript}` : transcript))} />
          <div className="ml-auto flex gap-2">
            <button type="button" className="mc-btn mc-btn-ghost" onClick={() => { close(); openTaskEditor(null); }}>
              Add a task manually
            </button>
            <button type="submit" className="mc-btn mc-btn-primary" disabled={pending || !text.trim()}>
              {pending ? "Thinking…" : "Get suggestions"}
            </button>
          </div>
        </div>
      </form>

      {pending ? (
        <p className="mt-4 inline-flex items-center gap-2" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Preparing suggestions…
        </p>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl border-2 border-danger p-3" role="alert">
          <p className="font-semibold text-danger">{error}</p>
          <p className="mc-hint">Your text is kept above. You can try again, or add tasks manually.</p>
          <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm mt-2" onClick={() => submit(text)}>
            <RotateCcw size={14} aria-hidden="true" /> Try again
          </button>
        </div>
      ) : null}

      {result ? (
        <section className="mt-5 flex flex-col gap-3" aria-label="Suggestions">
          <p className="whitespace-pre-wrap rounded-xl border border-border bg-background p-3">
            {result.data.reply}
            {result.data.question ? `\n\n${result.data.question}` : ""}
          </p>
          {result.data.proposals.map((proposal, index) => (
            <ProposalCard key={`${result.key}:${index}`} proposal={proposal} storageKey={`${result.key}:${index}`} />
          ))}
        </section>
      ) : null}
    </Modal>
  );
}
