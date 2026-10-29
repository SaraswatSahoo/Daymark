/* Daymark service worker.
 *
 * Responsibilities (deliberately small):
 * - Show notifications for reminders (Android requires notifications to come from a SW).
 * - Receive web-push messages when the server is configured with VAPID keys.
 * - Handle notification clicks and the Done / Snooze action buttons.
 *
 * It does NOT cache pages or data for offline use; Daymark needs its server.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const ACTIONS = [
  { action: "done", title: "Done" },
  { action: "snooze", title: "Snooze" },
];

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Daymark", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Reminder";
  event.waitUntil(
    (async () => {
      // If a Daymark window is focused, the in-app notifier already shows this reminder.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      if (data.reminderId && windows.some((w) => w.focused)) return;
      await self.registration.showNotification(title, {
        body: data.body || "",
        tag: data.tag || undefined,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        data: { url: data.url || "/reminders", reminderId: data.reminderId || null },
        actions: data.reminderId ? ACTIONS : [],
        requireInteraction: true,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  const { url, reminderId } = event.notification.data || {};
  event.notification.close();

  if (reminderId && (event.action === "done" || event.action === "snooze")) {
    event.waitUntil(
      fetch(`/api/reminders/${encodeURIComponent(reminderId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: event.action }),
      }).catch(() => undefined),
    );
    return;
  }

  event.waitUntil(
    (async () => {
      const target = new URL(url || "/", self.location.origin).href;
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          await w.focus();
          if ("navigate" in w) await w.navigate(target).catch(() => undefined);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
