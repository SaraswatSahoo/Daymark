import { NextResponse } from "next/server";
import { aiPublicStatus, checkConnection } from "@/server/ai/groq";
import { assertSameOrigin, jsonError } from "@/server/http";

export async function GET() {
  return NextResponse.json(aiPublicStatus(), { headers: { "Cache-Control": "no-store" } });
}

/** Checks the key and model availability via the models endpoint (no completion tokens used). */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    return NextResponse.json(await checkConnection());
  } catch (error) {
    return jsonError(error);
  }
}
