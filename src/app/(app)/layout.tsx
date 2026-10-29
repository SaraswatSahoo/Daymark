import { cookies } from "next/headers";
import { AppProvider } from "@/components/app/app-context";
import { Shell } from "@/components/app/shell";
import { ConfirmProvider } from "@/components/common/confirm";
import { SetupRequired } from "@/components/app/setup-required";
import { getToday } from "@/server/services/settings";
import { listProjectRefs } from "@/server/services/projects";
import { inboxCount } from "@/server/services/inbox";
import { db } from "@/server/db";
import { aiPublicStatus } from "@/server/ai/groq";
import type { ClientSettings } from "@/lib/types";

async function loadShellData() {
  const { settings, today } = await getToday();
  const [projects, tags, inbox, dueReminders] = await Promise.all([
    listProjectRefs(),
    db.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, color: true } }),
    inboxCount(),
    db.reminder.count({ where: { status: "pending", remindAt: { lte: new Date() } } }),
  ]);
  return { settings, today, projects, tags, inbox, dueReminders };
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  let data: Awaited<ReturnType<typeof loadShellData>>;
  try {
    data = await loadShellData();
  } catch (error) {
    return <SetupRequired message={error instanceof Error ? error.message : String(error)} />;
  }
  const jar = await cookies();
  const s = data.settings;
  const clientSettings: ClientSettings = {
    displayName: s.displayName,
    theme: s.theme,
    accent: s.accent,
    tz: s.tz,
    timezone: s.timezone,
    weekStart: s.weekStart,
    dateFormat: s.dateFormat,
    timeFormat: s.timeFormat,
    defaultPriority: s.defaultPriority,
    defaultReminderTime: s.defaultReminderTime,
    defaultSnoozeMinutes: s.defaultSnoozeMinutes,
    dashboardLayout: s.dashboardLayout,
  };

  return (
    <AppProvider
      settings={clientSettings}
      today={data.today}
      projects={data.projects}
      tags={data.tags}
      aiEnabled={aiPublicStatus().enabled}
      inboxCount={data.inbox}
      dueReminderCount={data.dueReminders}
      initialCollapsed={jar.get("daymark_sidebar")?.value === "collapsed"}
    >
      <ConfirmProvider>
        <Shell>{children}</Shell>
      </ConfirmProvider>
    </AppProvider>
  );
}
