import "server-only";

import { ApiError, GoogleGenAI } from "@google/genai";
import { getGeminiConfig } from "./server-env";

type ErrorCode = "not_configured" | "rate_limited" | "timeout" | "model_unavailable" | "invalid_output" | "provider_error";
type Provider = "gemini" | "groq";
type GenerateParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];
type RequestParams = Omit<GenerateParams, "model"> & { model?: string };
type Content = { role?: string; parts?: { text?: string; inlineData?: { mimeType?: string; data?: string } }[] };
type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  anyOf?: JsonSchema[];
  [key: string]: unknown;
};

function omitOptionalNulls(value: unknown, schema: JsonSchema): unknown {
  if (Array.isArray(value) && schema.items) return value.map((item) => omitOptionalNulls(item, schema.items!));
  if (value && typeof value === "object" && !Array.isArray(value) && schema.type === "object") {
    const required = new Set(schema.required ?? []);
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      if (child === null && !required.has(key)) continue;
      result[key] = schema.properties?.[key] ? omitOptionalNulls(child, schema.properties[key]) : child;
    }
    return result;
  }
  return value;
}

// Only log provider metadata. Error messages can include generated content.
async function throwGroqError(response: Response): Promise<never> {
  const details = await response.json().catch(() => null);
  console.warn("Groq request diagnostic", {
    status: response.status,
    code: details?.error?.code ?? null,
    type: details?.error?.type ?? null,
    retryAfter: response.headers.get("retry-after"),
  });
  if (response.status === 400 && details?.error?.code === "json_validate_failed") {
    throw new AiUnavailableError("invalid_output", "The AI service could not format its answer.");
  }
  throw providerFailure(response.status);
}

export class AiUnavailableError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
    this.name = "AiUnavailableError";
  }
}

function timeoutMs(value: string | number | undefined, fallback: number, ceiling: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, ceiling) : fallback;
}

function validateText(text: unknown, params: RequestParams, allowEmpty = false): string {
  if (typeof text !== "string" || (!allowEmpty && !text.trim())) {
    throw new AiUnavailableError("invalid_output", "The assistant returned an empty answer.");
  }
  if (params.config?.responseMimeType === "application/json") {
    try {
      const result = JSON.parse(text);
      if (!result || typeof result !== "object" || Array.isArray(result) || typeof result.reply !== "string" || !result.reply.trim()
        || !Array.isArray(result.proposals) || result.proposals.length > 3
        || (result.question !== undefined && typeof result.question !== "string")) throw new Error();
    } catch {
      throw new AiUnavailableError("invalid_output", "The assistant's answer could not be read.");
    }
  }
  return text;
}

function providerFailure(status: number): AiUnavailableError {
  if (status === 429) return new AiUnavailableError("rate_limited", "The AI service is busy right now.");
  if (status === 408 || status === 504) return new AiUnavailableError("timeout", "The assistant took too long to answer.");
  if (status === 404 || status === 503) return new AiUnavailableError("model_unavailable", "The AI model is unavailable right now.");
  return new AiUnavailableError("provider_error", "The assistant could not answer right now.");
}

async function withTimeout<T>(milliseconds: number, call: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), milliseconds);
  try {
    return await call(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) throw new AiUnavailableError("timeout", "The assistant took too long to answer.");
    if (error instanceof AiUnavailableError) throw error;
    if (error instanceof ApiError) throw providerFailure(error.status);
    throw new AiUnavailableError("provider_error", "The assistant could not answer right now.");
  } finally {
    clearTimeout(timer);
  }
}

async function generateGemini(params: RequestParams): Promise<string> {
  const config = getGeminiConfig();
  if (!config.apiKey.trim()) throw new AiUnavailableError("not_configured", "Gemini is not configured on this server.");
  // Reserve time for the other provider instead of waiting a full minute.
  const limit = process.env.GROQ_API_KEY?.trim() ? 8000 : 20000;
  return withTimeout(timeoutMs(config.timeoutMs, limit, limit), async (signal) => {
    const ai = new GoogleGenAI({ apiKey: config.apiKey.trim() });
    const result = await ai.models.generateContent({
      ...params,
      model: params.model ?? config.model,
      config: { ...params.config, abortSignal: signal },
    });
    return validateText(result.text, params);
  });
}

// The current MindCraft routes send text content, or one inline audio recording.
// Fail explicitly for other formats rather than silently dropping user input.
function getContents(params: RequestParams): Content[] {
  if (typeof params.contents === "string") return [{ role: "user", parts: [{ text: params.contents }] }];
  const items = Array.isArray(params.contents) ? params.contents : [params.contents];
  for (const item of items) {
    if (!item || typeof item !== "object" || !("parts" in item) || !Array.isArray(item.parts)) {
      throw new AiUnavailableError("provider_error", "This input format is not supported by the backup provider.");
    }
    for (const part of item.parts) {
      if (!part || typeof part !== "object" || !("text" in part || "inlineData" in part)) {
        throw new AiUnavailableError("provider_error", "This input format is not supported by the backup provider.");
      }
    }
  }
  return items as Content[];
}

async function generateGroq(params: RequestParams): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new AiUnavailableError("not_configured", "Groq is not configured on this server.");
  const contents = getContents(params);
  const recordings = contents.flatMap((item) => item.parts ?? []).filter((part) => part.inlineData);
  const duration = timeoutMs(process.env.GROQ_TIMEOUT_MS, 20000, 30000);

  return withTimeout(duration, async (signal) => {
    if (recordings.length) {
      if (recordings.length !== 1) throw new AiUnavailableError("provider_error", "Only one recording can be transcribed at a time.");
      const audio = recordings[0].inlineData!;
      const mime = audio.mimeType?.split(";")[0].toLowerCase() ?? "";
      const extensions: Record<string, string> = {
        "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4",
        "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-wav": "wav",
      };
      if (!audio.data || !extensions[mime]) throw new AiUnavailableError("provider_error", "This recording format cannot use the backup. Please type your message.");
      const form = new FormData();
      form.set("file", new Blob([Buffer.from(audio.data, "base64")], { type: mime }), `recording.${extensions[mime]}`);
      form.set("model", process.env.GROQ_TRANSCRIPTION_MODEL || "whisper-large-v3-turbo");
      form.set("response_format", "json");
      form.set("temperature", "0");
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form, signal,
      });
      if (!response.ok) await throwGroqError(response);
      const result = await response.json();
      return validateText(result.text, params, true);
    }

    const instruction = params.config?.systemInstruction;
    let systemText = "";
    if (typeof instruction === "string") systemText = instruction;
    else if (instruction) {
      throw new AiUnavailableError("provider_error", "The backup requires system instructions as text.");
    }
    const jsonMode = params.config?.responseMimeType === "application/json";
    const schema = params.config?.responseJsonSchema as JsonSchema | undefined;
    if (jsonMode) {
      systemText += `\n\nResponse format\nReturn only one JSON object with a nonempty reply string, an optional question string, and a proposals array. Use proposals: [] when a plain answer is enough. Omit optional fields when unknown; never invent dates, priorities, or preferences. Keep at most three proposals. Do not add Markdown fences or reasoning text. Follow this application schema for all field names and proposal shapes:\n${JSON.stringify(schema ?? { type: "object", required: ["reply", "proposals"] })}\nExample for a greeting: {"reply":"Hello, how can I help with your work?","proposals":[]}`;
    }
    const messages = [
      ...(systemText ? [{ role: "system", content: systemText }] : []),
      ...contents.map((item) => ({
        role: item.role === "model" ? "assistant" : "user",
        content: (item.parts ?? []).map((part) => part.text ?? "").join("\n"),
      })),
    ];
    const requestBody = {
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      reasoning_effort: "low",
      temperature: params.config?.temperature ?? 0.4,
      // Reasoning consumes completion tokens too. Keep a bounded allowance.
      max_completion_tokens: Math.max(3000, (params.config?.maxOutputTokens ?? 1500) + 1500),
    };
    let lastFormatError: AiUnavailableError | null = null;
    // Some generations fail the provider's JSON validator. Retry that case
    // once without constrained output, under the same timeout and app checks.
    const attempts = jsonMode ? 2 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const requestMessages = attempt === 0 ? messages : messages.map((message, index) =>
          index === 0 && message.role === "system"
            ? { ...message, content: `${message.content}\nFormatting reminder: answer the user's last request briefly using only the required JSON object. All properties must be double-quoted. A greeting or a first-step question can use an empty proposals array.` }
            : message,
        );
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            ...requestBody,
            messages: requestMessages,
            ...(jsonMode && attempt === 0 ? { response_format: { type: "json_object" } } : {}),
          }),
          signal,
        });
        if (!response.ok) await throwGroqError(response);
        const result = await response.json();
        const choice = result.choices?.[0];
        console.info("Groq response diagnostic", {
          format: jsonMode ? (attempt === 0 ? "json_object" : "prompt_json") : "text",
          finishReason: choice?.finish_reason ?? null,
          textLength: typeof choice?.message?.content === "string" ? choice.message.content.length : 0,
          promptTokens: result.usage?.prompt_tokens ?? null,
          completionTokens: result.usage?.completion_tokens ?? null,
          reasoningTokens: result.usage?.completion_tokens_details?.reasoning_tokens ?? null,
        });
        if (choice?.finish_reason === "length") throw new AiUnavailableError("invalid_output", "The assistant's answer was incomplete.");
        const content = choice?.message?.content;
        if (jsonMode && typeof content === "string") {
          try {
            // Removing an outer JSON fence changes formatting only, not content.
            const text = content.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1");
            const parsed: unknown = JSON.parse(text);
            const normalized = schema ? omitOptionalNulls(parsed, schema) : parsed;
            return validateText(JSON.stringify(normalized), params);
          } catch (error) {
            if (error instanceof AiUnavailableError) throw error;
            throw new AiUnavailableError("invalid_output", "The assistant's answer could not be read.");
          }
        }
        return validateText(content, params);
      } catch (error) {
        if (!(error instanceof AiUnavailableError) || error.code !== "invalid_output" || attempt + 1 >= attempts) throw error;
        lastFormatError = error;
        console.warn("Groq format retry", { nextFormat: "prompt_json" });
      }
    }
    throw lastFormatError ?? new AiUnavailableError("invalid_output", "The assistant's answer could not be read.");
  });
}

// Keep the existing import path so both API routes retain their authentication,
// request limits, task proposal checks, and confirmation flow.
export async function generate(params: RequestParams): Promise<string> {
  const primary: Provider = process.env.AI_PRIMARY_PROVIDER === "groq" ? "groq" : "gemini";
  const order: Provider[] = primary === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];
  let lastError = new AiUnavailableError("not_configured", "No AI provider is configured on this server.");
  let firstError: AiUnavailableError | null = null;
  for (const provider of order) {
    const configured = provider === "groq" ? process.env.GROQ_API_KEY?.trim() : getGeminiConfig().apiKey.trim();
    if (!configured) continue;
    try {
      const text = await (provider === "groq" ? generateGroq(params) : generateGemini(params));
      console.info("MindCraft AI response", { provider });
      return text;
    } catch (error) {
      lastError = error instanceof AiUnavailableError ? error : new AiUnavailableError("provider_error", "The assistant could not answer right now.");
      firstError ??= lastError;
      // Never log keys, recordings, prompts, or personal task data.
      console.warn("MindCraft AI provider failed", { provider, code: lastError.code });
    }
  }
  // A failed backup must not hide the original provider's actionable error.
  throw firstError ?? lastError;
}

export const AI_ERROR_STATUS: Record<ErrorCode, number> = {
  not_configured: 503, rate_limited: 429, timeout: 504,
  model_unavailable: 503, invalid_output: 502, provider_error: 502,
};
