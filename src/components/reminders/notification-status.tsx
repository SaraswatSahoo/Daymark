"use client";

import { useState, useSyncExternalStore } from "react";
import { BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { notificationPermission, requestNotificationPermission, type PermissionState } from "@/lib/client/notifications";

/** A gentle banner explaining notification status, with a button to request permission. */
export function NotificationStatus({ always = false }: { always?: boolean }) {
  const browserPerm = useSyncExternalStore<PermissionState | null>(
    () => () => {},
    notificationPermission,
    () => null,
  );
  const [requested, setPerm] = useState<PermissionState | null>(null);
  const perm = requested ?? browserPerm;
  if (perm === null || (perm === "granted" && !always)) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs" role="status">
      {perm === "granted" ? <BellRing className="size-4 text-success" aria-hidden /> : <BellOff className="size-4 text-muted-foreground" aria-hidden />}
      <p className="min-w-0 flex-1 text-muted-foreground">
        {perm === "granted" && "System notifications are on for this browser while Daymark is open."}
        {perm === "default" && "Turn on system notifications to be alerted even when this tab is in the background. In-app alerts work either way."}
        {perm === "denied" && "Notifications are blocked in your browser settings. You'll still see in-app alerts whenever Daymark is open — nothing is lost."}
        {perm === "unsupported" && "This browser doesn't support system notifications. You'll still see in-app alerts while Daymark is open."}
      </p>
      {perm === "default" && (
        <Button size="sm" variant="outline" onClick={async () => setPerm(await requestNotificationPermission())}>
          Enable notifications
        </Button>
      )}
    </div>
  );
}
