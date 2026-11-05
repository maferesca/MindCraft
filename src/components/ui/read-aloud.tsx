"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useWorkspaceData } from "../providers/workspace-data";
import { IconButton } from "./icon-button";

const LANGUAGE_CODES: Record<string, string> = {
  English: "en",
  Danish: "da",
  Spanish: "es",
  Italian: "it",
  German: "de",
  French: "fr",
  Portuguese: "pt",
};

const noSubscription = () => () => {};
const canSpeak = () => "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

// Uses the browser's own speech, so nothing leaves the device. It only plays when
// pressed, and the control is absent in browsers without speech support.
export function ReadAloud({ text, label = "Read aloud" }: { text: string; label?: string }) {
  const { preferences } = useWorkspaceData();
  const supported = useSyncExternalStore(noSubscription, canSpeak, () => false);
  const [speaking, setSpeaking] = useState(false);
  // Chrome can drop an utterance that nothing references, and it would never finish.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(
    () => () => {
      if (utteranceRef.current) window.speechSynthesis.cancel();
    },
    [],
  );

  if (!supported || !text.trim()) return null;

  function toggle() {
    window.speechSynthesis.cancel();
    if (speaking) {
      utteranceRef.current = null;
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const language = LANGUAGE_CODES[preferences.language];
    if (language) utterance.lang = language;
    const finished = () => {
      if (utteranceRef.current === utterance) utteranceRef.current = null;
      setSpeaking(false);
    };
    utterance.onend = finished;
    utterance.onerror = finished;
    utteranceRef.current = utterance;
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <IconButton
      size="sm"
      label={speaking ? "Stop reading" : label}
      icon={speaking ? <Square size={15} /> : <Volume2 size={17} />}
      aria-pressed={speaking}
      onClick={toggle}
    />
  );
}
