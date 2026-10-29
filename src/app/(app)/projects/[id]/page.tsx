import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListChecks } from "lucide-react";
import { getProject } from "@/server/services/projects";
import { listTasks } from "@/server/services/tasks";
import { listNotes } from "@/server/services/notes";
import { taskContext } from "@/server/actions/context";
import { PageHeader, Section } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { InlineAddTask, TaskList } from "@/components/tasks/task-list";
import { NoteListView } from "@/components/notes/notes-browser";
import { CollapsibleSection } from "@/components/common/collapsible-section";
import { ProgressBar } from "@/components/projects/projects-view";
import { ProjectHeaderActions } from "@/components/projects/project-header-actions";

export async function generateMetadata({ params }: PageProps<"/projects/[id]">): Promise<Metadata> {
  const { id } = await params;
  const p = await getProject(id);
  return { title: p?.name ?? "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();
  const ctx = await taskContext();
  const [open, done, notes] = await Promise.all([
    listTasks({ projectId: id, status: "open", sort: "smart" }, ctx),
    listTasks({ projectId: id, status: "done", sort: "updated" }, ctx),
    listNotes({ projectId: id }),
  ]);
  const total = project.openTasks + project.doneTasks;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader
        eyebrow={project.archivedAt ? "Archived project" : "Project"}
        title={
          <span className="flex items-center gap-2">
            {project.icon && <span aria-hidden>{project.icon}</span>}
            {project.name}
          </span>
        }
        description={project.description || undefined}
        actions={<ProjectHeaderActions project={project} />}
      />
      {total > 0 && (
        <div className="mb-8 max-w-md">
          <ProgressBar done={project.doneTasks} total={total} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {project.doneTasks} of {total} tasks done ({Math.round((project.doneTasks / total) * 100)}%)
          </p>
        </div>
      )}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-8">
          <Section title="Tasks" count={open.length}>
            <div className="rounded-xl border bg-card p-1.5 shadow-xs">
              <InlineAddTask defaults={{ projectId: id }} placeholder={`Add a task to ${project.name}`} />
            </div>
            {open.length ? (
              <TaskList tasks={open} showProject={false} className="mt-2" />
            ) : (
              <EmptyState compact icon={ListChecks} title="No open tasks" />
            )}
          </Section>
          {done.length > 0 && (
            <CollapsibleSection title="Completed" count={done.length}>
              <TaskList tasks={done} showProject={false} />
            </CollapsibleSection>
          )}
        </div>
        <Section title="Notes" count={notes.length}>
          {notes.length ? (
            <NoteListView notes={notes} view="list" />
          ) : (
            <p className="px-2 text-sm text-muted-foreground">No notes in this project yet.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
