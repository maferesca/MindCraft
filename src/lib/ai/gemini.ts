import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "./server-env";

export class AiUnavailableError extends Error {
  constructor(
    public code: "not_configured" | "rate_limited" | "timeout" | "model_unavailable" | "invalid_output" | "provider_error",
    message: string,
  ) {
    super(message);
  }
}

let client: GoogleGenAI | null = null;

function getClient() {
  const { apiKey } = getGeminiConfig();
  if (!apiKey) throw new AiUnavailableError("not_configured", "The assistant is not configured on this server yet.");
  client ??= new GoogleGenAI({ apiKey });
  return client;
}

type GenerateParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];

// Calls Gemini with a timeout and converts provider failures into a small set
// of errors the UI can explain without losing the user's draft.
export async function generate(params: Omit<GenerateParams, "model"> & { model?: string }): Promise<string> {
  const config = getGeminiConfig();
  const ai = getClient();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const response = await ai.models.generateContent({
      ...params,
      model: params.model ?? config.model,
      config: { ...params.config, abortSignal: controller.signal },
    });
    const text = response.text;
    if (!text) throw new AiUnavailableError("invalid_output", "The assistant returned an empty answer.");
    return text;
  } catch (error) {
    console.error("Gemini request diagnostic", {
      model: params.model ?? config.model,
      timeoutMs: config.timeoutMs,
      aborted: controller.signal.aborted,
      providerStatus: error instanceof ApiError ? error.status : null,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    if (error instanceof AiUnavailableError) throw error;
    if (controller.signal.aborted) throw new AiUnavailableError("timeout", "The assistant took too long to answer.");
    if (error instanceof ApiError) {
      if (error.status === 429) throw new AiUnavailableError("rate_limited", "The AI service is busy right now.");
      if (error.status === 404 || error.status === 503) {
        throw new AiUnavailableError("model_unavailable", "The AI model is unavailable right now.");
      }
    }
    console.error("Gemini request failed", error instanceof Error ? error.message : error);
    throw new AiUnavailableError("provider_error", "The assistant could not answer right now.");
  } finally {
    clearTimeout(timer);
  }
}

export const AI_ERROR_STATUS: Record<AiUnavailableError["code"], number> = {
  not_configured: 503,
  rate_limited: 429,
  timeout: 504,
  model_unavailable: 503,
  invalid_output: 502,
  provider_error: 502,
};
