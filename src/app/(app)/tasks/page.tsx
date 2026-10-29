import type { Metadata } from "next";
import { Suspense } from "react";
import { ListChecks } from "lucide-react";
import { listTasks } from "@/server/services/tasks";
import { taskContext } from "@/server/actions/context";
import { taskFilterSchema } from "@/lib/validation";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { InlineAddTask, TaskList } from "@/components/tasks/task-list";
import { TaskFilters } from "@/components/tasks/task-filters";

export const metadata: Metadata = { title: "All Tasks" };

const DEFAULTS = { status: "open", due: "any", sort: "smart", group: "none" };

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const parsed = taskFilterSchema.safeParse({
    status: one("status"),
    priority: one("priority"),
    projectId: one("project"),
    tag: one("tag"),
    due: one("due"),
    sort: one("sort"),
    group: one("group"),
    q: one("q"),
  });
  const filter = parsed.success ? parsed.data : taskFilterSchema.parse({});
  const ctx = await taskContext();
  const tasks = await listTasks(filter, ctx);
  const filtered = Object.entries({ ...filter }).some(
    ([k, v]) => v !== undefined && v !== "" && (DEFAULTS as Record<string, unknown>)[k] !== v && k !== "sort" && k !== "group",
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader title="All Tasks" description={`${tasks.length} ${tasks.length === 1 ? "task" : "tasks"}`} />
      <Suspense>
        <TaskFilters defaults={DEFAULTS} />
      </Suspense>
      {filter.status !== "done" && !filtered && (
        <div className="mb-2 rounded-xl border bg-card p-1.5 shadow-xs">
          <InlineAddTask />
        </div>
      )}
      {tasks.length ? (
        <TaskList tasks={tasks} group={filter.group} reorderable={filter.sort === "manual" && filter.group === "none"} />
      ) : (
        <EmptyState
          icon={ListChecks}
          title={filtered ? "No tasks match these filters" : "No tasks yet"}
          description={filtered ? "Try clearing a filter." : "Add your first task above, or press Q anywhere to capture one."}
        />
      )}
    </div>
  );
}
