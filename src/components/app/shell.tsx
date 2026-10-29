"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useApp } from "./app-context";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { QuickCapture } from "./quick-capture";
import { CommandPalette } from "./command-palette";
import { KeyboardShortcuts } from "./shortcuts";
import { TaskSheet } from "@/components/tasks/task-sheet";
import { ReminderDialog } from "@/components/reminders/reminder-dialog";
import { ReminderNotifier } from "@/components/reminders/reminder-notifier";
import { updateSettingsAction } from "@/server/actions/settings";

/** Opens overlays from URL params (?task=… / ?reminder=…) so search results and notifications can deep-link. */
function DeepLinks() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { openTask, openReminder } = useApp();
  useEffect(() => {
    const task = params.get("task");
    const reminder = params.get("open") && pathname === "/reminders" ? params.get("open") : params.get("reminder");
    if (!task && !reminder) return;
    if (task) openTask(task);
    if (reminder) openReminder({ id: reminder });
    const next = new URLSearchParams(params);
    next.delete("task");
    next.delete("reminder");
    next.delete("open");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router, openTask, openReminder]);
  return null;
}

/** On first run, adopt the browser's timezone so "today" matches the user's clock. */
function TimezoneSync() {
  const { settings } = useApp();
  const router = useRouter();
  useEffect(() => {
    if (settings.timezone) return;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    void updateSettingsAction({ timezone: tz }).then((r) => r.ok && router.refresh());
  }, [settings.timezone, router]);
  return null;
}

/** Re-renders date-dependent views when the day rolls over while the app stays open. */
function DayRollover() {
  const { today, settings } = useApp();
  const router = useRouter();
  useEffect(() => {
    const check = () => {
      const now = new Intl.DateTimeFormat("en-CA", { timeZone: settings.tz }).format(new Date());
      if (now !== today) router.refresh();
    };
    const t = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [today, settings.tz, router]);
  return null;
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav />
        <main id="main" className="min-w-0 flex-1 pb-[calc(var(--mobile-nav-h)+var(--safe-bottom)+1.5rem)] md:pb-10">
          {children}
        </main>
      </div>
      <QuickCapture />
      <CommandPalette />
      <TaskSheet />
      <ReminderDialog />
      <KeyboardShortcuts />
      <ReminderNotifier />
      <TimezoneSync />
      <DayRollover />
      <Suspense fallback={null}>
        <DeepLinks />
      </Suspense>
    </div>
  );
}
