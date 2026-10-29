/**
 * Starts the reminder push scheduler when running on a long-lived Node server
 * (`npm start` / `npm run dev`). It is a no-op unless VAPID keys are configured.
 * Serverless platforms do not keep this interval alive, so it is skipped on Vercel,
 * where /api/cron/push is called by an external cron instead; see README → Deploy.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return;
  if (process.env.DAYMARK_DISABLE_SCHEDULER === "1" || process.env.VERCEL) return;

  const g = globalThis as unknown as { __daymarkScheduler?: NodeJS.Timeout };
  if (g.__daymarkScheduler) return;

  const { deliverDuePushes } = await import("./server/push");
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await deliverDuePushes();
    } catch (error) {
      console.error("[scheduler] push delivery failed:", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };
  g.__daymarkScheduler = setInterval(tick, 30_000);
  g.__daymarkScheduler.unref?.();
  void tick();
  console.log("[scheduler] reminder push scheduler started (30s interval)");
}
