import "server-only";

// Server-only configuration. These values are never sent to the browser.
export function getGeminiConfig() {
  return {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    // One place for the model name; change it with the GEMINI_MODEL variable.
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    transcriptionModel: process.env.GEMINI_TRANSCRIPTION_MODEL || process.env.GEMINI_MODEL || "gemini-3.8-flash",
    timeoutMs: Number(process.env.GEMINI_TIMEOUT_MS || 20000),
  };
}

// Lets the local demo (no account) use AI. Keep this off on public deployments.
export const allowDemoAi = process.env.ALLOW_DEMO_AI === "true";
