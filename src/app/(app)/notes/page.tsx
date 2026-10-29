import type { Metadata } from "next";
import { Suspense } from "react";
import { listNotes } from "@/server/services/notes";
import { PageHeader } from "@/components/common/page-header";
import { NotesBrowser } from "@/components/notes/notes-browser";
import { NewNoteButton } from "@/components/notes/create-note-button";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage({ searchParams }: PageProps<"/notes">) {
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 200) : undefined);
  const q = one("q");
  const projectId = one("project");
  const tag = one("tag");
  const sortParam = one("sort");
  const sort = sortParam === "title" || sortParam === "created" ? sortParam : "updated";
  const notes = await listNotes({ q, projectId, tag, sort, journal: false });
  const filtered = !!(q || projectId || tag);
  const pinned = filtered ? [] : notes.filter((n) => n.pinned);
  const rest = filtered ? notes : notes.filter((n) => !n.pinned);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:pt-10">
      <PageHeader
        title="Notes"
        description={`${notes.length} ${notes.length === 1 ? "note" : "notes"}${filtered ? " found" : ""}`}
        actions={<NewNoteButton />}
      />
      <Suspense>
        <NotesBrowser pinned={pinned} notes={rest} filtered={filtered} />
      </Suspense>
    </div>
  );
}
