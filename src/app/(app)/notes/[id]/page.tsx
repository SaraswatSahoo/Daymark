import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getNote } from "@/server/services/notes";
import { NoteEditor } from "@/components/notes/note-editor";

export async function generateMetadata({ params }: PageProps<"/notes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const note = await getNote(id);
  return { title: note?.title || "Untitled note" };
}

export default async function NotePage({ params }: PageProps<"/notes/[id]">) {
  const { id } = await params;
  const note = await getNote(id);
  if (!note) notFound();
  // `key` remounts the editor (and its autosave state) when switching notes.
  return <NoteEditor key={note.id} note={note} />;
}
