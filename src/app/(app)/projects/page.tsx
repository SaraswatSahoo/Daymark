import type { Metadata } from "next";
import { listProjects } from "@/server/services/projects";
import { listTags } from "@/server/services/tags";
import { PageHeader, Section } from "@/components/common/page-header";
import { NewProjectButton, ProjectsGrid, TagManager } from "@/components/projects/projects-view";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const [projects, tags] = await Promise.all([listProjects(), listTags()]);
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader title="Projects" description="Lightweight homes for related tasks and notes." actions={<NewProjectButton />} />
      <ProjectsGrid projects={projects} />
      <Section title="Tags" count={tags.length} className="mt-12 max-w-2xl">
        <TagManager tags={tags} />
      </Section>
    </div>
  );
}
