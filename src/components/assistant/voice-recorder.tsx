"use client";

import { Loader2, Mic, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { transcribeRecording } from "@/lib/ai/client";
import { useNotify } from "../ui/notifications";

const MAX_SECONDS = 120;
type State = "idle" | "requesting" | "recording" | "processing";

// Records a short voice message only after the user presses Record.
// The audio is sent once for transcription and never kept in the app.
// The transcript goes into the text box for the user to review and edit.
export function VoiceRecorder({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [state, setState] = useState<State>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const { announce } = useNotify();

  const supported = typeof window !== "undefined" && "MediaRecorder" in window && !!navigator.mediaDevices?.getUserMedia;

  useEffect(() => {
    if (state !== "recording") return;
    const interval = window.setInterval(() => {
      setSeconds((value) => {
        if (value + 1 >= MAX_SECONDS) recorderRef.current?.stop();
        return value + 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [state]);

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), []);

  async function start() {
    setError(null);
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      cancelledRef.current = false;
      recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        if (cancelledRef.current) {
          setState("idle");
          announce("Recording cancelled.");
          return;
        }
        setState("processing");
        announce("Processing your recording.");
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        const result = await transcribeRecording(audio);
        setState("idle");
        if (!result.ok) {
          setError(result.message);
          return;
        }
        if (!result.data.trim()) {
          setError("Nothing was heard in the recording. You can try again or type instead.");
          return;
        }
        onTranscript(result.data);
        announce("Transcript ready. Check and edit it before sending.");
      };
      recorderRef.current = recorder;
      recorder.start();
      setSeconds(0);
      setState("recording");
      announce("Recording. Press Stop when you're done.");
    } catch {
      setState("idle");
      setError("Microphone access was not allowed or is not available. You can type instead.");
    }
  }

  if (!supported) return null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {state === "idle" ? (
          <button type="button" className="mc-btn mc-btn-secondary mc-btn-sm" onClick={start} disabled={disabled}>
            <Mic size={16} aria-hidden="true" /> Record a voice message
          </button>
        ) : null}
        {state === "requesting" ? <span className="mc-hint">Waiting for microphone permission…</span> : null}
        {state === "recording" ? (
          <>
            <span className="inline-flex items-center gap-2 font-semibold" role="status">
              <span className="h-2.5 w-2.5 rounded-full bg-danger" aria-hidden="true" />
              Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")} / 2:00
            </span>
            <button type="button" className="mc-btn mc-btn-primary mc-btn-sm" onClick={() => recorderRef.current?.stop()}>
              <Square size={14} aria-hidden="true" /> Stop
            </button>
            <button
              type="button"
              className="mc-btn mc-btn-ghost mc-btn-sm"
              onClick={() => {
                cancelledRef.current = true;
                recorderRef.current?.stop();
              }}
            >
              <X size={14} aria-hidden="true" /> Cancel
            </button>
          </>
        ) : null}
        {state === "processing" ? (
          <span className="inline-flex items-center gap-2" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Turning your recording into text…
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="mc-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
