import { redirect } from "next/navigation";
import Link from "next/link";
import { NotebookPen } from "lucide-react";
import { db } from "@/server/db";
import { EmptyState } from "@/components/common/empty-state";
import { CreateNoteWithTitle } from "@/components/notes/create-note-button";

/** Target of [[wiki links]]: opens the note with that title, or offers to create it. */
export default async function ResolveNotePage({ searchParams }: PageProps<"/notes/resolve">) {
  const sp = await searchParams;
  const title = typeof sp.title === "string" ? sp.title.trim().slice(0, 300) : "";
  if (title) {
    const exact = await db.note.findFirst({ where: { title, archivedAt: null }, select: { id: true }, orderBy: { updatedAt: "desc" } });
    if (exact) redirect(`/notes/${exact.id}`);
    // SQLite equality is case-sensitive; fall back to a case-insensitive scan of candidates.
    const candidates = await db.note.findMany({ where: { title: { contains: title }, archivedAt: null }, select: { id: true, title: true } });
    const ci = candidates.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (ci) redirect(`/notes/${ci.id}`);
  }
  return (
    <div className="mx-auto max-w-xl px-4 pt-16">
      <EmptyState icon={NotebookPen} title={title ? `No note called “${title}”` : "No note specified"} description="Linked notes are matched by title.">
        {title && <CreateNoteWithTitle title={title} />}
        <Link href="/notes" className="text-sm text-muted-foreground hover:underline">
          Back to notes
        </Link>
      </EmptyState>
    </div>
  );
}
