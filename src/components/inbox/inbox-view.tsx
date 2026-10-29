"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  Bell,
  Check,
  CheckSquare,
  ChevronDown,
  Inbox,
  Lightbulb,
  NotebookPen,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { useConfirm } from "@/components/common/confirm";
import { EmptyState } from "@/components/common/empty-state";
import { Section } from "@/components/common/page-header";
import { DateInput, ProjectSelect, TagInput } from "@/components/common/fields";
import { TaskRow } from "@/components/tasks/task-row";
import { Button } from "@/components/ui/button";
import { act } from "@/lib/client/action";
import {
  convertInboxItemAction,
  deleteInboxItemAction,
  markOrganizedAction,
  switchInboxKindAction,
  updateInboxItemAction,
} from "@/server/actions/organize";
import { archiveNoteAction, updateNoteAction } from "@/server/actions/notes";
import { updateTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";
import type { InboxItemDTO, NoteSummaryDTO, TaskDTO } from "@/lib/types";
import { TimeAgo } from "@/components/common/time";

function IdeaRow({ item }: { item: InboxItemDTO }) {
  const { openReminder } = useApp();
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(item.content);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [first, ...rest] = item.content.split("\n");

  const convert = async (to: "task" | "note") => {
    setBusy(true);
    const r = await act(convertInboxItemAction(item.id, to, { projectId, tags, dueDate: to === "task" ? dueDate : null }), {
      success: to === "task" ? "Converted to a task" : "Converted to a note",
    });
    setBusy(false);
    if (r?.type === "note") router.push(`/notes/${r.id}`);
  };

  return (
    <li className="rounded-lg px-2 py-2 hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const ok = await act(updateInboxItemAction(item.id, content), { success: "Saved" });
                if (ok !== undefined) setEditing(false);
              }}
            >
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
                aria-label="Edit idea"
                className="field-sizing-content w-full resize-none rounded-md border bg-transparent px-2 py-1 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/40"
              />
              <div className="mt-1 flex gap-1">
                <Button size="xs" type="submit">
                  Save
                </Button>
                <Button size="xs" variant="ghost" type="button" onClick={() => { setEditing(false); setContent(item.content); }}>
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <>
              <p className="break-words text-[0.92rem] leading-snug">{first}</p>
              {rest.length > 0 && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-muted-foreground">{rest.join("\n")}</p>}
              <p className="mt-0.5 text-[0.72rem] text-muted-foreground">
                <TimeAgo date={item.createdAt} />
              </p>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label="Edit idea">
            <Pencil />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            Process <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-2 ml-7 space-y-2 rounded-lg border bg-card p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <ProjectSelect value={projectId} onChange={setProjectId} />
            <TagInput value={tags} onChange={setTags} />
            <DateInput value={dueDate} onChange={setDueDate} aria-label="Due date (tasks only)" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" disabled={busy} onClick={() => convert("task")}>
              <CheckSquare /> Make it a task
            </Button>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => convert("note")}>
              <NotebookPen /> Make it a note
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openReminder({ title: first.slice(0, 300), date: dueDate ?? undefined })}
            >
              <Bell /> Set a reminder
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto text-destructive hover:text-destructive"
              onClick={async () => {
                if (await confirm({ title: "Delete this idea?", confirmLabel: "Delete", destructive: true }))
                  void act(deleteInboxItemAction(item.id), { success: "Idea deleted" });
              }}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

function InboxTask({ task }: { task: TaskDTO }) {
  return (
    <div className="rounded-lg">
      <ul>
        <TaskRow task={task} />
      </ul>
      <div className="mb-1 ml-10 flex flex-wrap items-center gap-1.5">
        <ProjectSelect
          value={task.project?.id}
          onChange={(projectId) => void act(markAndUpdateProject(task.id, projectId), { success: "Moved to project" })}
          className="h-7 w-auto max-w-[12rem] text-xs"
          placeholder="Move to project…"
        />
        <Button size="xs" variant="ghost" onClick={() => void act(markOrganizedAction("task", task.id), { success: "Organized" })}>
          <Check /> Keep, mark organized
        </Button>
        <Button size="xs" variant="ghost" onClick={() => void act(switchInboxKindAction("task", task.id), { success: "Converted to a note" })}>
          <ArrowRightLeft /> Make it a note
        </Button>
      </div>
    </div>
  );
}

function markAndUpdateProject(taskId: string, projectId: string | null) {
  return updateTaskAction({ id: taskId, projectId, inbox: projectId ? false : undefined });
}

function InboxNote({ note }: { note: NoteSummaryDTO }) {
  return (
    <li className="rounded-lg px-2 py-2 hover:bg-muted/40">
      <div className="flex items-start gap-3">
        <NotebookPen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Link href={`/notes/${note.id}`} className="min-w-0 flex-1">
          <p className="truncate text-[0.92rem]">{note.title || "Untitled note"}</p>
          {note.excerpt && <p className="line-clamp-1 text-xs text-muted-foreground">{note.excerpt}</p>}
        </Link>
      </div>
      <div className="mt-1 ml-7 flex flex-wrap items-center gap-1.5">
        <ProjectSelect
          value={note.project?.id}
          onChange={(projectId) => void act(updateNoteAction({ id: note.id, projectId, inbox: false }), { success: "Moved to project" })}
          className="h-7 w-auto max-w-[12rem] text-xs"
          placeholder="Move to project…"
        />
        <Button size="xs" variant="ghost" onClick={() => void act(markOrganizedAction("note", note.id), { success: "Organized" })}>
          <Check /> Keep, mark organized
        </Button>
        <Button size="xs" variant="ghost" onClick={() => void act(switchInboxKindAction("note", note.id), { success: "Converted to a task" })}>
          <ArrowRightLeft /> Make it a task
        </Button>
        <Button size="xs" variant="ghost" onClick={() => void act(archiveNoteAction(note.id, true), { success: "Archived" })}>
          Archive
        </Button>
      </div>
    </li>
  );
}

export function InboxView({ ideas, tasks, notes }: { ideas: InboxItemDTO[]; tasks: TaskDTO[]; notes: NoteSummaryDTO[] }) {
  const { openCapture } = useApp();
  if (!ideas.length && !tasks.length && !notes.length) {
    return (
      <EmptyState
        icon={Inbox}
        title="Inbox zero"
        description="Anything you capture without a project or date lands here, ready to organize when you have a minute."
      >
        <Button size="sm" onClick={() => openCapture({ kind: "idea" })}>
          <Plus /> Capture something
        </Button>
      </EmptyState>
    );
  }
  return (
    <div className="space-y-8">
      {ideas.length > 0 && (
        <Section title="Ideas" count={ideas.length}>
          <ul className="space-y-0.5">
            {ideas.map((i) => (
              <IdeaRow key={i.id} item={i} />
            ))}
          </ul>
        </Section>
      )}
      {tasks.length > 0 && (
        <Section title="Tasks" count={tasks.length}>
          <div className="divide-y divide-border/60">
            {tasks.map((t) => (
              <InboxTask key={t.id} task={t} />
            ))}
          </div>
        </Section>
      )}
      {notes.length > 0 && (
        <Section title="Notes" count={notes.length}>
          <ul className="divide-y divide-border/60">
            {notes.map((n) => (
              <InboxNote key={n.id} note={n} />
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
