import type { Metadata } from "next";
import { CalendarRange } from "lucide-react";
import { getUpcomingTasks } from "@/server/services/tasks";
import { getRemindersInRange } from "@/server/services/reminders";
import { taskContext } from "@/server/actions/context";
import { PageHeader, Section } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { InlineAddTask, TaskList } from "@/components/tasks/task-list";
import { ReminderRow } from "@/components/reminders/reminder-row";
import { UpcomingActions } from "@/components/tasks/upcoming-actions";
import { addDaysISO, isoDateInTz, rangeISO, relativeDayLabel, startOfDayInstant, formatISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Upcoming" };

export default async function UpcomingPage() {
  const ctx = await taskContext();
  const DAYS = 14;
  const [{ scheduled, overdue }, reminders] = await Promise.all([
    getUpcomingTasks(ctx, DAYS),
    getRemindersInRange(startOfDayInstant(ctx.today, ctx.tz), startOfDayInstant(addDaysISO(ctx.today, DAYS), ctx.tz)),
  ]);
  const pendingReminders = reminders.filter((r) => r.status === "pending");
  const days = rangeISO(ctx.today, DAYS);
  const empty = scheduled.length === 0 && pendingReminders.length === 0 && overdue.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader
        title="Upcoming"
        description={`The next two weeks · through ${formatISO(addDaysISO(ctx.today, DAYS - 1), "MMM d")}`}
        actions={<UpcomingActions />}
      />

      {overdue.length > 0 && (
        <Section title="Overdue" count={overdue.length} className="mb-8">
          <TaskList tasks={overdue} />
        </Section>
      )}

      {empty ? (
        <EmptyState
          icon={CalendarRange}
          title="Nothing scheduled"
          description="Tasks with due dates and reminders for the next two weeks will appear here."
        />
      ) : (
        <div className="space-y-6">
          {days.map((day) => {
            const tasks = scheduled.filter((t) => t.dueDate === day);
            const rems = pendingReminders.filter((r) => isoDateInTz(new Date(r.remindAt), ctx.tz) === day);
            const isToday = day === ctx.today;
            if (!tasks.length && !rems.length && !isToday) return null;
            return (
              <section key={day} aria-labelledby={`day-${day}`}>
                <h2 id={`day-${day}`} className="mb-1 flex items-baseline gap-2 border-b pb-1.5 px-2">
                  <span className="font-display text-lg font-semibold">{relativeDayLabel(day, ctx.today)}</span>
                  <span className="text-xs text-muted-foreground">{formatISO(day, "MMM d")}</span>
                </h2>
                {rems.length > 0 && (
                  <ul className="mb-1">
                    {rems.map((r) => (
                      <ReminderRow key={r.id} reminder={r} />
                    ))}
                  </ul>
                )}
                {tasks.length > 0 && <TaskList tasks={tasks} showDate={false} />}
                <InlineAddTask defaults={{ dueDate: day }} placeholder={`Add a task for ${relativeDayLabel(day, ctx.today).toLowerCase()}`} className="opacity-70 focus-within:opacity-100 hover:opacity-100" />
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
