import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { deliverDuePushes } from "@/server/push";
import { jsonError } from "@/server/http";

/**
 * GET /api/cron/push — sends web push for due reminders.
 *
 * Serverless hosts (Vercel) can't keep the 30s scheduler in `instrumentation.ts`
 * alive, so an external cron service calls this every minute instead, with
 * `Authorization: Bearer <CRON_SECRET>`. Excluded from the session check in
 * `proxy.ts`; disabled unless CRON_SECRET is set.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (!matches(request.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sent = await deliverDuePushes();
    return NextResponse.json({ ok: true, sent }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

/** Constant-time comparison (hashing first makes the lengths equal). */
function matches(a: string, b: string) {
  const hash = (s: string) => createHash("sha256").update(s).digest();
  return timingSafeEqual(hash(a), hash(b));
}
