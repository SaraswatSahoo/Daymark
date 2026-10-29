import type { Metadata } from "next";
import { Sun } from "lucide-react";
import { getMyDay, getUpcomingTasks } from "@/server/services/tasks";
import { taskContext } from "@/server/actions/context";
import { PageHeader, Section } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { InlineAddTask, TaskList } from "@/components/tasks/task-list";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { formatISO } from "@/lib/dates";

export const metadata: Metadata = { title: "My Day" };

export default async function MyDayPage() {
  const ctx = await taskContext();
  const [{ planned, overdue, completed }, upcoming] = await Promise.all([getMyDay(ctx), getUpcomingTasks(ctx, 4)]);
  const plannedIds = new Set(planned.map((t) => t.id));
  const suggestions = upcoming.scheduled.filter((t) => !plannedIds.has(t.id) && t.dueDate !== ctx.today).slice(0, 5);
  const total = planned.length + completed.length;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader
        eyebrow={formatISO(ctx.today, "EEEE, MMMM d")}
        title="My Day"
        description={
          total ? `${completed.length} of ${total} done${planned.length ? ` · ${planned.length} to go` : ""}` : "Choose what matters today."
        }
      />
      <div className="space-y-8">
        <div className="rounded-xl border bg-card p-2 shadow-xs">
          <InlineAddTask defaults={{ myDay: true }} placeholder="Add a task to My Day" />
          {planned.length > 0 ? (
            <div className="border-t pt-1">
              <TaskList tasks={planned} reorderable />
            </div>
          ) : (
            <EmptyState
              compact
              icon={Sun}
              title={completed.length ? "Everything planned is done" : "Nothing planned yet"}
              description="Add tasks here, or use the ☀ button on any task to bring it into today."
            />
          )}
        </div>

        {overdue.length > 0 && (
          <Section title="Overdue" count={overdue.length}>
            <TaskList tasks={overdue} />
          </Section>
        )}

        {suggestions.length > 0 && (
          <Section title="Coming up soon">
            <TaskList tasks={suggestions} />
          </Section>
        )}

        {completed.length > 0 && (
          <CollapsibleSection title="Completed today" count={completed.length}>
            <TaskList tasks={completed} />
          </CollapsibleSection>
        )}
      </div>
    </div>
  );
}
