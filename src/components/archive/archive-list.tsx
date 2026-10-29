"use client";

import Link from "next/link";
import { ArchiveRestore, CheckSquare, FolderKanban, NotebookPen, Trash2 } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { useConfirm } from "@/components/common/confirm";
import { Button } from "@/components/ui/button";
import { act } from "@/lib/client/action";
import { archiveTaskAction, deleteTaskAction } from "@/server/actions/tasks";
import { archiveNoteAction, deleteNoteAction } from "@/server/actions/notes";
import { archiveProjectAction, deleteProjectAction } from "@/server/actions/organize";
import { TimeAgo } from "@/components/common/time";

type Kind = "task" | "note" | "project";
const ICONS = { task: CheckSquare, note: NotebookPen, project: FolderKanban };

export function ArchiveList({ kind, items }: { kind: Kind; items: { id: string; title: string; archivedAt: string | null }[] }) {
  const { openTask } = useApp();
  const confirm = useConfirm();
  const Icon = ICONS[kind];

  const restore = (id: string) =>
    act(
      kind === "task" ? archiveTaskAction(id, false) : kind === "note" ? archiveNoteAction(id, false) : archiveProjectAction(id, false),
      { success: "Restored" },
    );
  const remove = async (id: string, title: string) => {
    const ok = await confirm({
      title: `Delete “${title}” permanently?`,
      description:
        kind === "project"
          ? "The project is deleted; its tasks and notes are kept and become unassigned."
          : "This can't be undone.",
      confirmLabel: "Delete forever",
      destructive: true,
    });
    if (!ok) return;
    await act(kind === "task" ? deleteTaskAction(id) : kind === "note" ? deleteNoteAction(id) : deleteProjectAction(id, false), {
      success: "Deleted",
    });
  };

  return (
    <ul className="divide-y divide-border/60">
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-3 px-2 py-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {kind === "task" ? (
            <button type="button" onClick={() => openTask(i.id)} className="min-w-0 flex-1 truncate text-left text-sm hover:underline">
              {i.title}
            </button>
          ) : (
            <Link href={kind === "note" ? `/notes/${i.id}` : `/projects/${i.id}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
              {i.title}
            </Link>
          )}
          {i.archivedAt && (
            <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
              <TimeAgo date={i.archivedAt} />
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => void restore(i.id)}>
            <ArchiveRestore /> <span className="hidden sm:inline">Restore</span>
          </Button>
          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label={`Delete ${i.title} permanently`} onClick={() => void remove(i.id, i.title)}>
            <Trash2 />
          </Button>
        </li>
      ))}
    </ul>
  );
}
