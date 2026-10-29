import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * Exercises the Groq integration end-to-end against a local mock of the
 * OpenAI-compatible chat completions API (no real key or network needed).
 */
let server: Server;
let lastBody: Record<string, unknown> = {};
let calls = 0;
let mode: "ok" | "429" | "500" | "badjson" = "ok";

function reply(content: string) {
  return JSON.stringify({
    id: "x",
    object: "chat.completion",
    created: 0,
    model: "mock",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
  });
}

beforeAll(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      calls++;
      lastBody = JSON.parse(raw || "{}");
      if (mode === "429") {
        res.writeHead(429, { "content-type": "application/json", "retry-after": "7" });
        return res.end(JSON.stringify({ error: { message: "rate limited", code: "rate_limit_exceeded" } }));
      }
      if (mode === "500") {
        res.writeHead(500, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "boom" } }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      if (mode === "badjson") return res.end(reply("{not json"));
      const format = lastBody.response_format as { type?: string; json_schema?: { name: string } } | undefined;
      if (format?.json_schema?.name === "extracted_tasks") {
        return res.end(
          reply(JSON.stringify({ tasks: [{ title: "Email Prof. Lee", dueDate: "2026-10-30", priority: "high", notes: null }] })),
        );
      }
      if (format?.json_schema?.name === "subtasks") return res.end(reply(JSON.stringify({ subtasks: ["Outline", "Draft", "Edit"] })));
      res.end(reply("- Key point one\n- Key point two"));
    });
  });
  await new Promise<void>((r) => server.listen(0, r));
  const { port } = server.address() as AddressInfo;
  vi.stubEnv("GROQ_API_KEY", "test-key-not-real");
  vi.stubEnv("GROQ_MODEL", "openai/gpt-oss-20b");
  vi.stubEnv("GROQ_BASE_URL", `http://127.0.0.1:${port}`);
});

afterAll(() => {
  vi.unstubAllEnvs();
  server.close();
});

describe("AI operations with a configured key (mocked Groq)", () => {
  it("summarizes, sending only the note and bounded tokens", async () => {
    mode = "ok";
    const { runAiOperation } = await import("@/server/ai/operations");
    const r = await runAiOperation({ op: "summarize", title: "Lecture", content: "Some lecture notes" });
    expect(r).toMatchObject({ op: "summarize", text: expect.stringContaining("Key point") });
    expect(lastBody.model).toBe("openai/gpt-oss-20b");
    expect(lastBody.max_completion_tokens).toBeLessThanOrEqual(1500);
    expect(lastBody.reasoning_effort).toBe("low");
    expect(JSON.stringify(lastBody.messages)).toContain("Some lecture notes");
  });

  it("extracts tasks via strict JSON schema and validates them", async () => {
    mode = "ok";
    const { runAiOperation } = await import("@/server/ai/operations");
    const r = await runAiOperation({ op: "extract-tasks", title: "", content: "Email Prof. Lee by Friday", today: "2026-10-29" });
    expect(r.op).toBe("extract-tasks");
    if (r.op === "extract-tasks") expect(r.tasks[0]).toMatchObject({ title: "Email Prof. Lee", dueDate: "2026-10-30" });
    expect((lastBody.response_format as { type: string }).type).toBe("json_schema");
  });

  it("breaks a task down into subtasks", async () => {
    mode = "ok";
    const { runAiOperation } = await import("@/server/ai/operations");
    const r = await runAiOperation({ op: "breakdown", title: "Write essay", description: "", existing: [] });
    if (r.op === "breakdown") expect(r.subtasks).toEqual(["Outline", "Draft", "Edit"]);
  });

  it("reports rate limits with retry-after and does not retry automatically", async () => {
    mode = "429";
    const before = calls;
    const { runAiOperation } = await import("@/server/ai/operations");
    await expect(runAiOperation({ op: "summarize", title: "", content: "x" })).rejects.toMatchObject({
      code: "rate_limited",
      retryAfter: 7,
    });
    expect(calls - before).toBe(1);
  });

  it("handles server errors and malformed model output gracefully", async () => {
    const { runAiOperation } = await import("@/server/ai/operations");
    mode = "500";
    await expect(runAiOperation({ op: "summarize", title: "", content: "x" })).rejects.toMatchObject({ code: "upstream" });
    mode = "badjson";
    await expect(runAiOperation({ op: "title", content: "hello" })).rejects.toMatchObject({ code: "bad_output" });
  });
});
