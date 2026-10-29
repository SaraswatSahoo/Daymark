import { NextResponse } from "next/server";
import { z } from "zod";
import { pushConfig, removeSubscription, saveSubscription, sendTestPush } from "@/server/push";
import { assertSameOrigin, jsonError, readJson } from "@/server/http";

export async function GET() {
  const { enabled, publicKey } = pushConfig();
  return NextResponse.json({ enabled, publicKey: enabled ? publicKey : null });
}

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(500), auth: z.string().min(1).max(200) }),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("subscribe"), subscription: subscriptionSchema }),
  z.object({ action: z.literal("unsubscribe"), endpoint: z.string().url().max(2000) }),
  z.object({ action: z.literal("test") }),
]);

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!pushConfig().enabled) {
      return NextResponse.json({ error: "Web push is not configured on the server (VAPID keys missing)." }, { status: 503 });
    }
    const body = bodySchema.parse(await readJson(request, 10_000));
    if (body.action === "subscribe") {
      await saveSubscription(body.subscription, request.headers.get("user-agent") ?? undefined);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "unsubscribe") {
      await removeSubscription(body.endpoint);
      return NextResponse.json({ ok: true });
    }
    const delivered = await sendTestPush();
    return NextResponse.json({ ok: delivered > 0, delivered });
  } catch (error) {
    return jsonError(error);
  }
}
