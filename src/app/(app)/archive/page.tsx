import type { Metadata } from "next";
import { Archive } from "lucide-react";
import { db } from "@/server/db";
import { taskInclude, toTaskDTO } from "@/server/mappers";
import { listNotes } from "@/server/services/notes";
import { listProjects } from "@/server/services/projects";
import { PageHeader, Section } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ArchiveList } from "@/components/archive/archive-list";

export const metadata: Metadata = { title: "Archive" };

export default async function ArchivePage() {
  const [tasks, notes, projects] = await Promise.all([
    db.task.findMany({ where: { archivedAt: { not: null } }, include: taskInclude, orderBy: { archivedAt: "desc" }, take: 500 }),
    listNotes({ archived: true }),
    listProjects({ archived: true }),
  ]);
  const empty = !tasks.length && !notes.length && !projects.length;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader title="Archive" description="Out of sight, not deleted. Restore anything, or delete it for good." />
      {empty ? (
        <EmptyState icon={Archive} title="The archive is empty" description="Archived tasks, notes and projects appear here." />
      ) : (
        <div className="space-y-8">
          {projects.length > 0 && (
            <Section title="Projects" count={projects.length}>
              <ArchiveList kind="project" items={projects.map((p) => ({ id: p.id, title: p.name, archivedAt: p.archivedAt }))} />
            </Section>
          )}
          {notes.length > 0 && (
            <Section title="Notes" count={notes.length}>
              <ArchiveList kind="note" items={notes.map((n) => ({ id: n.id, title: n.title || "Untitled note", archivedAt: n.archivedAt }))} />
            </Section>
          )}
          {tasks.length > 0 && (
            <Section title="Tasks" count={tasks.length}>
              <ArchiveList
                kind="task"
                items={tasks.map(toTaskDTO).map((t) => ({ id: t.id, title: t.title, archivedAt: t.archivedAt }))}
              />
            </Section>
          )}
        </div>
      )}
    </div>
  );
}
