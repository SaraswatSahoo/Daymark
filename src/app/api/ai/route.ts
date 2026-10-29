import { NextResponse } from "next/server";
import { aiRequestSchema } from "@/lib/ai-schemas";
import { formatZodError } from "@/lib/validation";
import { AiError, aiConfig, checkLocalRateLimit } from "@/server/ai/groq";
import { runAiOperation } from "@/server/ai/operations";
import { assertSameOrigin, jsonError, readJson } from "@/server/http";

/**
 * Single entry point for the optional AI features. Called only from explicit user
 * actions. Request bodies are size-bounded and validated; note content is never logged.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!aiConfig().enabled) {
      return NextResponse.json(
        { error: "AI features are disabled. Add GROQ_API_KEY to your .env to enable them.", code: "disabled" },
        { status: 503 },
      );
    }
    const parsed = aiRequestSchema.safeParse(await readJson(request, 100_000));
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error), code: "invalid_input" }, { status: 400 });
    }
    checkLocalRateLimit();
    const result = await runAiOperation(parsed.data, request.signal);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AiError) {
      if (error.code !== "aborted") console.warn(`[ai] request failed: ${error.code}`);
      return NextResponse.json(
        { error: error.message, code: error.code, retryAfter: error.retryAfter },
        { status: error.status, headers: error.retryAfter ? { "Retry-After": String(error.retryAfter) } : undefined },
      );
    }
    return jsonError(error);
  }
}
