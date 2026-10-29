"use client";

/** Browser notification helpers. All functions are safe to call where the APIs are missing. */

export type PermissionState = NotificationPermission | "unsupported";

export function notificationPermission(): PermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === "unsupported") return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return notificationPermission();
  }
}

export async function getServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return (await navigator.serviceWorker.getRegistration("/")) ?? null;
  } catch {
    return null;
  }
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!window.isSecureContext) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

/** Shows a system notification (through the service worker when available, which Android requires). */
export async function showSystemNotification(
  title: string,
  options: { body?: string; tag?: string; url?: string; reminderId?: string },
): Promise<boolean> {
  if (notificationPermission() !== "granted") return false;
  const data = { url: options.url ?? "/", reminderId: options.reminderId ?? null };
  const reg = await getServiceWorker();
  try {
    if (reg) {
      await reg.showNotification(title, {
        body: options.body,
        tag: options.tag,
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-72.png",
        data,
        requireInteraction: true,
        // `actions` is supported by Chromium; ignored elsewhere.
        ...({ actions: options.reminderId ? [{ action: "done", title: "Done" }, { action: "snooze", title: "Snooze" }] : [] } as object),
      });
      return true;
    }
    const n = new Notification(title, { body: options.body, tag: options.tag, icon: "/icons/icon-192.png" });
    n.onclick = () => {
      window.focus();
      if (options.url) window.location.assign(options.url);
    };
    return true;
  } catch {
    return false;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const reg = await getServiceWorker();
  if (!reg || !("pushManager" in reg)) return null;
  try {
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

export async function subscribeToPush(publicKey: string): Promise<{ ok: boolean; error?: string }> {
  const reg = (await getServiceWorker()) ?? (await registerServiceWorker());
  if (!reg || !("pushManager" in reg)) return { ok: false, error: "This browser does not support push notifications." };
  if ((await requestNotificationPermission()) !== "granted") return { ok: false, error: "Notification permission was not granted." };
  try {
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "subscribe", subscription: sub.toJSON() }),
    });
    if (!res.ok) return { ok: false, error: (await res.json().catch(() => ({}))).error ?? "Could not save the subscription." };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Subscription failed." };
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const sub = await currentPushSubscription();
  if (!sub) return;
  await fetch("/api/push", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unsubscribe", endpoint: sub.endpoint }),
  }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}
