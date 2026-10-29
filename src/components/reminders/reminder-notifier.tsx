"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { act } from "@/lib/client/action";
import { resolveReminderAction, snoozeReminderAction } from "@/server/actions/reminders";
import { currentPushSubscription, registerServiceWorker, showSystemNotification } from "@/lib/client/notifications";
import type { ReminderDTO } from "@/lib/types";

const POLL_MS = 30_000;

/**
 * In-app reminder delivery while Daymark is open in a tab:
 * polls the server every 30s (and on focus), schedules a precise timer for the next
 * reminder, and shows an in-app toast plus a system notification when permitted.
 * Reminders are never dropped: due reminders stay "due" until the user acts.
 */
export function ReminderNotifier() {
  const { settings, openReminder } = useApp();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = useRef(new Set<string>());
  const snooze = settings.defaultSnoozeMinutes;

  useEffect(() => {
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const announce = async (r: ReminderDTO) => {
      if (shown.current.has(r.id + r.remindAt)) return;
      shown.current.add(r.id + r.remindAt);
      toast(r.title, {
        id: `reminder-${r.id}`,
        description: r.description || r.task?.title || "Reminder",
        duration: Infinity,
        icon: "⏰",
        action: {
          label: "Done",
          onClick: () => void act(resolveReminderAction(r.id, "done"), { success: "Reminder completed" }),
        },
        cancel: {
          label: `Snooze ${snooze < 60 ? `${snooze}m` : `${Math.round(snooze / 60)}h`}`,
          onClick: () => void act(snoozeReminderAction(r.id, snooze), { success: `Snoozed for ${snooze} minutes` }),
        },
        onDismiss: () => undefined,
      });
      // If this device receives web push, the service worker shows the system notification.
      const pushed = !!(await currentPushSubscription());
      if (!pushed || document.visibilityState === "visible") {
        if (document.visibilityState !== "visible" || !document.hasFocus()) {
          await showSystemNotification(r.title, {
            body: r.description || "Reminder",
            tag: `reminder-${r.id}`,
            url: `/reminders?open=${r.id}`,
            reminderId: r.id,
          });
        }
      }
    };

    const poll = async () => {
      if (timer.current) clearTimeout(timer.current);
      try {
        const res = await fetch("/api/reminders/poll", { method: "POST", cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data: { fresh: ReminderDTO[]; due: ReminderDTO[]; nextAt: string | null } = await res.json();
        if (cancelled) return;
        for (const r of data.fresh) await announce(r);
        if (data.fresh.length) router.refresh();
        // Schedule the next check precisely when the next reminder is due (bounded by the poll interval).
        const untilNext = data.nextAt ? new Date(data.nextAt).getTime() - Date.now() + 500 : POLL_MS;
        timer.current = setTimeout(poll, Math.max(1_000, Math.min(POLL_MS, untilNext)));
      } catch {
        if (!cancelled) timer.current = setTimeout(poll, POLL_MS);
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    void poll();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [router, snooze, openReminder]);

  return null;
}
