"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, FolderKanban, MoreHorizontal, Plus, Tag, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/common/empty-state";
import { useConfirm } from "@/components/common/confirm";
import { ProjectDialog } from "./project-dialog";
import { act } from "@/lib/client/action";
import { deleteTagAction, reorderProjectsAction, updateTagAction } from "@/server/actions/organize";
import { colorClasses } from "@/lib/colors";
import { ITEM_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ProjectDTO } from "@/lib/types";

export function ProgressBar({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
      <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function NewProjectButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus /> New project
      </Button>
      <ProjectDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

export function ProjectsGrid({ projects }: { projects: ProjectDTO[] }) {
  if (!projects.length) {
    return (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Create projects for courses, internships, coding projects, goals — whatever you're working on."
      >
        <NewProjectButton />
      </EmptyState>
    );
  }
  const move = (i: number, d: -1 | 1) => {
    const ids = projects.map((p) => p.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    void act(reorderProjectsAction(ids));
  };
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((p, i) => {
        const total = p.openTasks + p.doneTasks;
        return (
          <li key={p.id} className="group relative">
            <Link href={`/projects/${p.id}`} className="flex h-full flex-col rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-foreground/20">
              <span className="flex items-center gap-2">
                {p.icon ? (
                  <span className="text-lg" aria-hidden>
                    {p.icon}
                  </span>
                ) : (
                  <span className={cn("size-2.5 rounded-full", colorClasses(p.color).dot)} aria-hidden />
                )}
                <span className="truncate pr-8 font-medium">{p.name}</span>
              </span>
              {p.description && <span className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</span>}
              <span className="mt-auto pt-4">
                <ProgressBar done={p.doneTasks} total={total} />
                <span className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {p.openTasks} open · {p.doneTasks} done
                  </span>
                  <span>
                    {p.noteCount} {p.noteCount === 1 ? "note" : "notes"}
                  </span>
                </span>
              </span>
            </Link>
            {!p.archivedAt && (
              <div className="absolute top-3 right-3 flex sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                <Button variant="ghost" size="icon-xs" aria-label={`Move ${p.name} earlier`} onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp />
                </Button>
                <Button variant="ghost" size="icon-xs" aria-label={`Move ${p.name} later`} onClick={() => move(i, 1)} disabled={i === projects.length - 1}>
                  <ArrowDown />
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function TagManager({ tags }: { tags: { id: string; name: string; color: string; taskCount: number; noteCount: number }[] }) {
  const confirm = useConfirm();
  if (!tags.length) {
    return <p className="px-2 text-sm text-muted-foreground">Tags appear here when you add them to tasks or notes (type #tag in quick capture).</p>;
  }
  return (
    <ul className="divide-y divide-border/60">
      {tags.map((t) => (
        <li key={t.id} className="flex items-center gap-3 px-2 py-2">
          <Tag className={cn("size-3.5", colorClasses(t.color).text)} aria-hidden />
          <span className="min-w-0 flex-1 truncate text-sm">#{t.name}</span>
          <span className="hidden text-xs text-muted-foreground sm:inline">
            <Link href={`/tasks?tag=${encodeURIComponent(t.name)}&status=all`} className="hover:underline">
              {t.taskCount} tasks
            </Link>
            {" · "}
            <Link href={`/notes?tag=${encodeURIComponent(t.name)}`} className="hover:underline">
              {t.noteCount} notes
            </Link>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Manage tag ${t.name}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => {
                  const name = window.prompt("Rename tag", t.name);
                  if (name && name.trim() && name.trim() !== t.name) void act(updateTagAction({ id: t.id, name }), { success: "Tag renamed" });
                }}
              >
                Rename…
              </DropdownMenuItem>
              <div className="flex flex-wrap gap-1.5 px-2 py-1.5" role="group" aria-label="Tag color">
                {ITEM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Color ${c}`}
                    aria-pressed={t.color === c}
                    onClick={() => void act(updateTagAction({ id: t.id, color: c }))}
                    className={cn("size-4 rounded-full", colorClasses(c).dot, t.color === c && "ring-2 ring-foreground ring-offset-1 ring-offset-popover")}
                  />
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={async () => {
                  if (
                    await confirm({
                      title: `Delete #${t.name}?`,
                      description: "The tag is removed from all tasks and notes. The items themselves are kept.",
                      confirmLabel: "Delete tag",
                      destructive: true,
                    })
                  )
                    void act(deleteTagAction(t.id), { success: "Tag deleted" });
                }}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </li>
      ))}
    </ul>
  );
}
