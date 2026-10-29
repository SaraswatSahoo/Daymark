import "server-only";
import { NextResponse } from "next/server";
import { toErrorMessage, UserError } from "./action-result";
import { ZodError } from "zod";

/** Rejects cross-site requests to mutating route handlers (server actions do this automatically). */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new UserError("Cross-origin request blocked.");
  } catch (e) {
    if (e instanceof UserError) throw e;
    throw new UserError("Invalid origin.");
  }
}

export function jsonError(error: unknown, fallbackStatus = 500) {
  const status = error instanceof ZodError || error instanceof UserError ? 400 : fallbackStatus;
  return NextResponse.json({ error: toErrorMessage(error) }, { status });
}

export async function readJson(request: Request, maxBytes = 2_000_000): Promise<unknown> {
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new UserError("Request is too large.");
  const text = await request.text();
  if (text.length > maxBytes) throw new UserError("Request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new UserError("Invalid JSON.");
  }
}
