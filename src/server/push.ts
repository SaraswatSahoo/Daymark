import webpush from "web-push";
import { db } from "./db";

/**
 * Web push delivery for reminders while the app is closed.
 *
 * Requires VAPID keys (npm run vapid) and a long-running Node server (`npm start`),
 * because a scheduler in `instrumentation.ts` checks for due reminders every 30s.
 * Browsers only allow push on HTTPS origins (or http://localhost).
 */

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:daymark@localhost";
  return { enabled: !!publicKey && !!privateKey, publicKey, privateKey, subject };
}

let configured = false;
function ensureConfigured(): boolean {
  const cfg = pushConfig();
  if (!cfg.enabled) return false;
  if (!configured) {
    webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
    configured = true;
  }
  return true;
}

export async function saveSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  await db.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) },
    create: { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 300) },
  });
}

export async function removeSubscription(endpoint: string) {
  await db.pushSubscription.deleteMany({ where: { endpoint } });
}

async function sendToAll(payload: Record<string, unknown>): Promise<number> {
  const subs = await db.pushSubscription.findMany();
  let delivered = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 6, urgency: "high" },
        );
        delivered++;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: the browser revoked the subscription.
        if (status === 404 || status === 410) await removeSubscription(s.endpoint);
        else console.error("[push] delivery failed with status", status ?? "unknown");
      }
    }),
  );
  return delivered;
}

export async function sendTestPush(): Promise<number> {
  if (!ensureConfigured()) return 0;
  return sendToAll({ title: "Daymark", body: "Push notifications are working.", url: "/settings", tag: "test" });
}

/** Sends a push for each due reminder that hasn't been pushed yet. Safe to call repeatedly. */
export async function deliverDuePushes(): Promise<number> {
  if (!ensureConfigured()) return 0;
  if ((await db.pushSubscription.count()) === 0) return 0;
  const due = await db.reminder.findMany({
    where: { status: "pending", remindAt: { lte: new Date() }, pushedAt: null },
    take: 20,
  });
  let sent = 0;
  for (const r of due) {
    // Claim first so concurrent schedulers never double-send.
    const claimed = await db.reminder.updateMany({ where: { id: r.id, pushedAt: null }, data: { pushedAt: new Date() } });
    if (claimed.count !== 1) continue;
    // Skip very stale reminders (e.g. server was off for days) to avoid a burst of old alerts.
    if (Date.now() - r.remindAt.getTime() > 12 * 60 * 60 * 1000) continue;
    sent += await sendToAll({
      title: r.title,
      body: r.description?.slice(0, 200) || "Reminder",
      url: `/reminders?open=${r.id}`,
      tag: `reminder-${r.id}`,
      reminderId: r.id,
    });
  }
  return sent;
}
