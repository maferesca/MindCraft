"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { chooseVoice, speechLanguage } from "@/lib/speech";
import { useWorkspaceData } from "../providers/workspace-data";
import { IconButton } from "./icon-button";

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

  useEffect(() => {
    // Browsers load voices on first request, so ask before the button is pressed.
    if (canSpeak()) window.speechSynthesis.getVoices();
    return () => {
      if (utteranceRef.current) window.speechSynthesis.cancel();
    };
  }, []);

  if (!supported || !text.trim()) return null;

  function toggle() {
    window.speechSynthesis.cancel();
    if (speaking) {
      utteranceRef.current = null;
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const language = speechLanguage(preferences.language, text);
    const voice = chooseVoice(window.speechSynthesis.getVoices(), language, preferences.speechVoice);
    utterance.lang = voice?.lang ?? language;
    if (voice) utterance.voice = voice;
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
