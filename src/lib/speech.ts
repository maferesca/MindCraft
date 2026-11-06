// Chooses what Read aloud sounds like. Without a chosen voice the browser uses the
// system default, which on a Spanish computer reads English with a Spanish voice.

const LANGUAGE_CODES: Record<string, string> = {
  English: "en",
  Danish: "da",
  Spanish: "es",
  Italian: "it",
  German: "de",
  French: "fr",
  Portuguese: "pt",
};

const SPANISH_TEXT = /[áéíóúñ¿¡]|\b(el|los|las|una|para|que|con|por|del)\b/i;

// The assistant's language setting decides. On automatic, the text does.
export function speechLanguage(setting: string, text: string) {
  return LANGUAGE_CODES[setting] ?? (SPANISH_TEXT.test(text) ? "es" : "en");
}

type Voice = Pick<SpeechSynthesisVoice, "name" | "lang" | "voiceURI">;

const matches = (voice: Voice, language: string) => voice.lang.toLowerCase().startsWith(language);

// Natural and online voices sound far better than the older installed ones.
function quality(voice: Voice) {
  let score = 0;
  if (/natural|neural|online/i.test(voice.name)) score += 4;
  if (/google/i.test(voice.name)) score += 2;
  if (/samantha|aria|jenny|guy/i.test(voice.name)) score += 1;
  if (/^en-us/i.test(voice.lang)) score += 1;
  return score;
}

export function voicesFor<T extends Voice>(voices: readonly T[], language: string) {
  return voices.filter((voice) => matches(voice, language)).sort((a, b) => quality(b) - quality(a));
}

// A chosen voice is used only for its own language, because an English voice
// reading Spanish would have the same problem in reverse.
export function chooseVoice<T extends Voice>(voices: readonly T[], language: string, chosenUri: string) {
  const fitting = voicesFor(voices, language);
  return fitting.find((voice) => voice.voiceURI === chosenUri) ?? fitting[0] ?? null;
}
