import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import { getCompletedTasks } from "@/server/services/tasks";
import { taskContext } from "@/server/actions/context";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { TaskList } from "@/components/tasks/task-list";
import { isoDateInTz, relativeDayLabel, formatISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Completed" };

export default async function CompletedPage() {
  const ctx = await taskContext();
  const tasks = await getCompletedTasks(500);
  const groups = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const day = t.completedAt ? isoDateInTz(new Date(t.completedAt), ctx.tz) : "unknown";
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(t);
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader title="Completed" description="Your record of finished work. Recurring tasks keep every completed occurrence." />
      {tasks.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nothing completed yet" description="Completed tasks are kept here as history." />
      ) : (
        <div className="space-y-6">
          {[...groups.entries()].map(([day, list]) => (
            <section key={day} aria-labelledby={`done-${day}`}>
              <h2 id={`done-${day}`} className="mb-1 flex items-baseline gap-2 border-b px-2 pb-1.5">
                <span className="font-display text-lg font-semibold">{day === "unknown" ? "Earlier" : relativeDayLabel(day, ctx.today)}</span>
                {day !== "unknown" && <span className="text-xs text-muted-foreground">{formatISO(day, "MMM d, yyyy")}</span>}
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{list.length}</span>
              </h2>
              <TaskList tasks={list} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
