import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { listReminders } from "@/server/services/reminders";
import { PageHeader, Section } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ReminderRow } from "@/components/reminders/reminder-row";
import { RemindersActions } from "@/components/reminders/reminders-actions";
import { NotificationStatus } from "@/components/reminders/notification-status";

export const metadata: Metadata = { title: "Reminders" };

export default async function RemindersPage() {
  const [due, upcoming, history] = await Promise.all([listReminders("due"), listReminders("upcoming"), listReminders("history")]);
  const recent = history.filter((r) => r.status !== "pending").slice(0, 40);

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader title="Reminders" description="Due reminders stay here until you mark them done, snooze or dismiss them." actions={<RemindersActions />} />
      <NotificationStatus />
      {due.length === 0 && upcoming.length === 0 && recent.length === 0 ? (
        <EmptyState icon={Bell} title="No reminders yet" description="Create one here, from a task, or type “remind: call mom tomorrow 6pm” in quick capture." />
      ) : (
        <div className="space-y-8">
          {due.length > 0 && (
            <Section title="Due now" count={due.length}>
              <ul>
                {due.map((r) => (
                  <ReminderRow key={r.id} reminder={r} />
                ))}
              </ul>
            </Section>
          )}
          <Section title="Upcoming" count={upcoming.length}>
            {upcoming.length ? (
              <ul>
                {upcoming.map((r) => (
                  <ReminderRow key={r.id} reminder={r} />
                ))}
              </ul>
            ) : (
              <p className="px-2 text-sm text-muted-foreground">Nothing scheduled.</p>
            )}
          </Section>
          {recent.length > 0 && (
            <Section title="Recent history">
              <ul>
                {recent.map((r) => (
                  <ReminderRow key={r.id} reminder={r} />
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
