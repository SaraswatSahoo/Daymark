import type { Metadata } from "next";
import { getSettings } from "@/server/services/settings";
import { aiPublicStatus } from "@/server/ai/groq";
import { pushConfig } from "@/server/push";
import { authEnabled } from "@/lib/auth-token";
import { PageHeader } from "@/components/common/page-header";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  const push = pushConfig();
  let timezones: string[] = [];
  try {
    timezones = Intl.supportedValuesOf("timeZone");
  } catch {
    timezones = [settings.tz];
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader title="Settings" description="Everything is saved automatically." />
      <SettingsView
        initial={{
          displayName: settings.displayName,
          theme: settings.theme,
          accent: settings.accent,
          timezone: settings.timezone,
          tz: settings.tz,
          weekStart: settings.weekStart,
          dateFormat: settings.dateFormat,
          timeFormat: settings.timeFormat,
          defaultPriority: settings.defaultPriority,
          defaultReminderTime: settings.defaultReminderTime,
          defaultSnoozeMinutes: settings.defaultSnoozeMinutes,
          dashboardLayout: settings.dashboardLayout,
        }}
        timezones={timezones}
        ai={aiPublicStatus()}
        push={{ enabled: push.enabled, publicKey: push.enabled ? push.publicKey : null }}
        auth={authEnabled()}
      />
    </div>
  );
}
