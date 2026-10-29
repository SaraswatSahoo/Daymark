import "server-only";
import Groq from "groq-sdk";

/**
 * Groq client wrapper. The API key is read from the server environment only and is
 * never sent to the browser or logged. AI is entirely optional: when GROQ_API_KEY is
 * absent every AI entry point reports "disabled" and the rest of the app is unaffected.
 */

export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

export function aiConfig() {
  const apiKey = process.env.GROQ_API_KEY?.trim() || "";
  const model = process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL;
  return { enabled: apiKey.length > 0, model, apiKey };
}

export function aiPublicStatus() {
  const { enabled, model } = aiConfig();
  return { enabled, model };
}

let client: Groq | null = null;
let clientKey = "";

function getClient(): Groq {
  const { apiKey } = aiConfig();
  if (!apiKey) throw new AiError("AI features are disabled. Add GROQ_API_KEY to your .env to enable them.", 503, "disabled");
  if (!client || clientKey !== apiKey) {
    // No automatic retries: a retry silently spends more of the free-tier quota.
    client = new Groq({ apiKey, maxRetries: 0, timeout: 45_000 });
    clientKey = apiKey;
  }
  return client;
}

export type AiErrorCode =
  | "disabled"
  | "auth"
  | "rate_limited"
  | "model_unavailable"
  | "too_large"
  | "bad_output"
  | "upstream"
  | "network"
  | "aborted"
  | "invalid_input"
  | "local_limit";

export class AiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: AiErrorCode,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

/** Maps Groq SDK errors to messages a user can act on. Never includes request content or the key. */
export function toAiError(error: unknown, model: string): AiError {
  if (error instanceof AiError) return error;
  if (error instanceof Groq.APIUserAbortError) return new AiError("Request cancelled.", 499, "aborted");
  if (error instanceof Groq.APIConnectionTimeoutError)
    return new AiError("Groq took too long to respond. Please try again.", 504, "network");
  if (error instanceof Groq.APIConnectionError)
    return new AiError("Could not reach Groq. Check your internet connection.", 502, "network");
  if (error instanceof Groq.APIError) {
    const status = error.status ?? 500;
    const body = (error.error ?? {}) as { error?: { code?: string; message?: string }; code?: string };
    const code = body.error?.code ?? body.code ?? "";
    if (status === 401 || status === 403)
      return new AiError("Groq rejected the API key. Check GROQ_API_KEY in your .env.", 502, "auth");
    if (status === 429) {
      const retry = Number(error.headers?.get?.("retry-after"));
      const wait = Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : undefined;
      return new AiError(
        `Groq's free-tier rate limit was reached${wait ? `. Try again in ${wait}s` : ". Try again shortly"}.`,
        429,
        "rate_limited",
        wait,
      );
    }
    if (status === 404 || code === "model_not_found" || code === "model_decommissioned")
      return new AiError(
        `The model "${model}" is not available on your Groq account. Set GROQ_MODEL to a model listed at console.groq.com/docs/models.`,
        502,
        "model_unavailable",
      );
    if (status === 413 || code === "context_length_exceeded")
      return new AiError("That text is too long for the model. Try a shorter selection.", 413, "too_large");
    if (status === 400 && (code === "json_validate_failed" || code === "output_parse_failed"))
      return new AiError("The model returned an unexpected format. Please try again.", 502, "bad_output");
    if (status >= 500) return new AiError("Groq is temporarily unavailable. Please try again later.", 502, "upstream");
    return new AiError(`Groq request failed (${status}).`, 502, "upstream");
  }
  return new AiError("The AI request failed unexpectedly.", 500, "upstream");
}

const isGptOss = (model: string) => model.startsWith("openai/gpt-oss");
const supportsStrictSchema = (model: string) =>
  isGptOss(model) || model.startsWith("qwen/") || model.startsWith("meta-models/");

/** Model-specific request options (reasoning controls only where the model supports them). */
function modelOptions(model: string) {
  if (isGptOss(model)) return { reasoning_effort: "low" as const, include_reasoning: false };
  return {};
}

interface CompletionArgs {
  system: string;
  user: string;
  maxTokens: number;
  temperature?: number;
  signal?: AbortSignal;
}

export async function completeText({ system, user, maxTokens, temperature = 0.4, signal }: CompletionArgs) {
  const { model } = aiConfig();
  const groq = getClient();
  try {
    const res = await groq.chat.completions.create(
      {
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature,
        max_completion_tokens: maxTokens,
        ...modelOptions(model),
      },
      { signal },
    );
    const text = res.choices[0]?.message?.content?.trim() ?? "";
    if (!text) throw new AiError("The model returned an empty response. Please try again.", 502, "bad_output");
    return { text, model };
  } catch (error) {
    throw toAiError(error, model);
  }
}

export async function completeJson<T>(
  args: CompletionArgs & { schemaName: string; jsonSchema: Record<string, unknown>; parse: (value: unknown) => T },
): Promise<{ data: T; model: string }> {
  const { model } = aiConfig();
  const groq = getClient();
  const strict = supportsStrictSchema(model);
  try {
    const res = await groq.chat.completions.create(
      {
        model,
        messages: [
          {
            role: "system",
            content: strict
              ? args.system
              : `${args.system}\n\nRespond with JSON only, matching this JSON Schema:\n${JSON.stringify(args.jsonSchema)}`,
          },
          { role: "user", content: args.user },
        ],
        temperature: args.temperature ?? 0.2,
        max_completion_tokens: args.maxTokens,
        response_format: strict
          ? { type: "json_schema", json_schema: { name: args.schemaName, strict: true, schema: args.jsonSchema } }
          : { type: "json_object" },
        ...modelOptions(model),
      },
      { signal: args.signal },
    );
    const raw = res.choices[0]?.message?.content ?? "";
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AiError("The model returned invalid JSON. Please try again.", 502, "bad_output");
    }
    try {
      return { data: args.parse(parsed), model };
    } catch {
      throw new AiError("The model's response did not match the expected format. Please try again.", 502, "bad_output");
    }
  } catch (error) {
    throw toAiError(error, model);
  }
}

/** Verifies the key and that the configured model is listed — does not consume completion tokens. */
export async function checkConnection(): Promise<{ ok: boolean; model: string; message: string; models?: string[] }> {
  const { model, enabled } = aiConfig();
  if (!enabled) return { ok: false, model, message: "GROQ_API_KEY is not set, so AI features are disabled." };
  try {
    const list = await getClient().models.list();
    const ids = list.data.map((m) => m.id).sort();
    const found = ids.includes(model);
    return {
      ok: found,
      model,
      models: ids.filter((id) => !/whisper|tts|orpheus|guard|playai|distil/i.test(id)),
      message: found
        ? `Connected. "${model}" is available on your account.`
        : `Connected, but "${model}" is not in your account's model list. Choose one of the models below and set GROQ_MODEL.`,
    };
  } catch (error) {
    const e = toAiError(error, model);
    return { ok: false, model, message: e.message };
  }
}

/* --------------- Local guard against runaway usage (per server process) --------------- */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 15;
const calls: number[] = [];

export function checkLocalRateLimit() {
  const now = Date.now();
  while (calls.length && now - calls[0] > WINDOW_MS) calls.shift();
  if (calls.length >= MAX_PER_WINDOW) {
    throw new AiError(
      "You've made a lot of AI requests in the last minute. Wait a moment to protect your free-tier quota.",
      429,
      "local_limit",
      Math.ceil((WINDOW_MS - (now - calls[0])) / 1000),
    );
  }
  calls.push(now);
}
