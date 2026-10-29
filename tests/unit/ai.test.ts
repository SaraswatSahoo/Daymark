import { describe, expect, it, vi } from "vitest";
import { aiRequestSchema, breakdownResponseSchema, extractTasksResponseSchema } from "@/lib/ai-schemas";

describe("AI request validation", () => {
  it("bounds request sizes", () => {
    expect(aiRequestSchema.safeParse({ op: "summarize", title: "", content: "x".repeat(12_001) }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ op: "summarize", content: "hello" }).success).toBe(true);
    expect(aiRequestSchema.safeParse({ op: "rewrite", mode: "shorten", text: "" }).success).toBe(false);
    expect(aiRequestSchema.safeParse({ op: "unknown" }).success).toBe(false);
  });

  it("validates structured responses before use", () => {
    expect(extractTasksResponseSchema.safeParse({ tasks: [{ title: "Email Sam", dueDate: null, priority: null, notes: null }] }).success).toBe(true);
    expect(extractTasksResponseSchema.safeParse({ tasks: [{ title: "", dueDate: "tomorrow", priority: "p1", notes: null }] }).success).toBe(false);
    expect(breakdownResponseSchema.safeParse({ subtasks: [] }).success).toBe(false);
  });
});

describe("AI availability", () => {
  it("is disabled without GROQ_API_KEY and refuses requests", async () => {
    vi.stubEnv("GROQ_API_KEY", "");
    const { aiConfig, completeText } = await import("@/server/ai/groq");
    expect(aiConfig().enabled).toBe(false);
    await expect(completeText({ system: "s", user: "u", maxTokens: 10 })).rejects.toMatchObject({ code: "disabled" });
    vi.unstubAllEnvs();
  });

  it("maps Groq API errors to actionable messages", async () => {
    const Groq = (await import("groq-sdk")).default;
    const { toAiError } = await import("@/server/ai/groq");
    const headers = new Headers({ "retry-after": "12" });
    const rate = toAiError(new Groq.RateLimitError(429, { error: { message: "x" } }, "rate", headers), "m");
    expect(rate.code).toBe("rate_limited");
    expect(rate.retryAfter).toBe(12);
    const auth = toAiError(new Groq.AuthenticationError(401, {}, "bad key", new Headers()), "m");
    expect(auth.code).toBe("auth");
    const missing = toAiError(new Groq.NotFoundError(404, { error: { code: "model_not_found" } }, "nf", new Headers()), "my-model");
    expect(missing.code).toBe("model_unavailable");
    expect(missing.message).toContain("my-model");
  });

  it("enforces the local per-minute guard", async () => {
    const { checkLocalRateLimit } = await import("@/server/ai/groq");
    let blocked = false;
    for (let i = 0; i < 20; i++) {
      try {
        checkLocalRateLimit();
      } catch {
        blocked = true;
        break;
      }
    }
    expect(blocked).toBe(true);
  });
});
