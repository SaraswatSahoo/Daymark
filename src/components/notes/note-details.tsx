"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Link2, NotebookPen, Plus, X } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { ProjectSelect, TagInput, fieldInputClass } from "@/components/common/fields";
import { TaskList } from "@/components/tasks/task-list";
import { Button } from "@/components/ui/button";
import { act } from "@/lib/client/action";
import { linkNotesAction, searchNoteOptionsAction, unlinkNotesAction, updateNoteAction } from "@/server/actions/notes";
import type { NoteDetailDTO } from "@/lib/types";
import { DateTime } from "@/components/common/time";

export function NoteDetails({ note, onTaskFromSelection }: { note: NoteDetailDTO; onTaskFromSelection: () => void }) {
  const { openReminder, openCapture } = useApp();
  const [linking, setLinking] = useState(false);
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!linking) return;
    const t = setTimeout(async () => {
      const r = await searchNoteOptionsAction(query, note.id);
      if (r.ok) setOptions(r.data.filter((o) => !note.related.some((x) => x.id === o.id)));
    }, 150);
    return () => clearTimeout(t);
  }, [linking, query, note.id, note.related]);

  return (
    <div className="space-y-6 text-sm">
      <div className="space-y-2">
        <label htmlFor="note-project" className="block text-[0.78rem] text-muted-foreground">
          Project
        </label>
        <ProjectSelect id="note-project" value={note.project?.id} onChange={(projectId) => void act(updateNoteAction({ id: note.id, projectId }))} />
      </div>
      <div className="space-y-2">
        <label htmlFor="note-tags" className="block text-[0.78rem] text-muted-foreground">
          Tags
        </label>
        <TagInput id="note-tags" value={note.tags.map((t) => t.name)} onChange={(tags) => void act(updateNoteAction({ id: note.id, tags }))} />
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-[0.78rem] text-muted-foreground">Tasks</h3>
          <Button variant="ghost" size="xs" className="ml-auto" onClick={onTaskFromSelection}>
            <Plus /> From selection
          </Button>
        </div>
        {note.tasks.length ? (
          <TaskList tasks={note.tasks} showProject={false} />
        ) : (
          <p className="px-1 text-xs text-muted-foreground">
            Select text in the editor and choose “From selection”, or link this note from any task.
          </p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-[0.78rem] text-muted-foreground">Related notes</h3>
          <Button variant="ghost" size="xs" className="ml-auto" onClick={() => setLinking((v) => !v)} aria-expanded={linking}>
            <Link2 /> Link
          </Button>
        </div>
        {linking && (
          <div className="mb-2 space-y-1">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes…"
              aria-label="Search notes to link"
              className={fieldInputClass}
            />
            <ul className="max-h-40 overflow-y-auto rounded-lg border">
              {options.length === 0 && <li className="px-3 py-2 text-xs text-muted-foreground">No matching notes</li>}
              {options.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="w-full truncate px-3 py-1.5 text-left hover:bg-muted"
                    onClick={async () => {
                      const r = await act(linkNotesAction(note.id, o.id), { success: "Notes linked" });
                      if (r !== undefined) setLinking(false);
                    }}
                  >
                    {o.title || "Untitled"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {note.related.length ? (
          <ul className="space-y-0.5">
            {note.related.map((r) => (
              <li key={r.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60">
                <NotebookPen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <Link href={`/notes/${r.id}`} className="min-w-0 flex-1 truncate hover:underline">
                  {r.title || "Untitled"}
                </Link>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Unlink ${r.title || "note"}`}
                  onClick={() => void act(unlinkNotesAction(note.id, r.id), { success: "Unlinked" })}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          !linking && <p className="px-1 text-xs text-muted-foreground">Link related notes, or type [[Note title]] in the text.</p>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-[0.78rem] text-muted-foreground">Backlinks</h3>
        {note.backlinks.length ? (
          <ul className="space-y-0.5">
            {note.backlinks.map((b) => (
              <li key={b.id}>
                <Link href={`/notes/${b.id}`} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60">
                  <NotebookPen className="size-3.5 text-muted-foreground" aria-hidden />
                  <span className="truncate">{b.title || "Untitled"}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-1 text-xs text-muted-foreground">
            {note.title ? `No notes mention [[${note.title}]] yet.` : "Give this note a title to collect backlinks."}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => openReminder({ title: note.title || "Review note", noteId: note.id })}>
          <Bell /> Remind me
        </Button>
        <Button variant="outline" size="sm" onClick={() => openCapture({ kind: "task", projectId: note.project?.id })}>
          <Plus /> New task
        </Button>
      </div>

      <dl className="space-y-1 border-t pt-4 text-xs text-muted-foreground">
        <div className="flex justify-between gap-2">
          <dt>Created</dt>
          <dd><DateTime date={note.createdAt} /></dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Modified</dt>
          <dd><DateTime date={note.updatedAt} /></dd>
        </div>
        {note.journalDate && (
          <div className="flex justify-between gap-2">
            <dt>Journal</dt>
            <dd>{note.journalDate}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
