"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Loader2,
  NotebookPen,
  Plus,
  Sparkles,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { useConfirm } from "@/components/common/confirm";
import {
  DateInput,
  FieldRow,
  PrioritySelect,
  ProjectSelect,
  RecurrenceSelect,
  TagInput,
  TimeInput,
  fieldInputClass,
} from "@/components/common/fields";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskCheckbox } from "./task-checkbox";
import { act } from "@/lib/client/action";
import { useAi } from "@/lib/client/use-ai";
import {
  addSubtaskAction,
  addSubtasksAction,
  archiveTaskAction,
  deleteSubtaskAction,
  deleteTaskAction,
  getTaskAction,
  setTaskReminderAction,
  setTaskStatusAction,
  updateSubtaskAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import { createNoteAction, searchNoteOptionsAction } from "@/server/actions/notes";
import { isoDateInTz, timeInTz, zonedToInstant, relativeDayLabel } from "@/lib/dates";
import { STATUS_LABELS, TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskDetailDTO } from "@/lib/types";
import type { TaskUpdateInput } from "@/lib/validation";
import { DateTime, TimeAgo } from "@/components/common/time";

function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { settings, today, aiEnabled } = useApp();
  const router = useRouter();
  const confirm = useConfirm();
  const ai = useAi();
  const [task, setTask] = useState<TaskDetailDTO | null>(null);
  const [missing, setMissing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [suggested, setSuggested] = useState<{ title: string; keep: boolean }[] | null>(null);
  const [noteQuery, setNoteQuery] = useState("");
  const [noteOptions, setNoteOptions] = useState<{ id: string; title: string }[]>([]);
  const [linking, setLinking] = useState(false);

  const [version, setVersion] = useState(0);
  /** Re-fetches the task after a mutation. */
  const load = useCallback(async () => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    getTaskAction(taskId).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setTask(res.data);
        setTitle(res.data.title);
        setDescription(res.data.description);
      } else setMissing(true);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, version]);

  useEffect(() => {
    if (!linking) return;
    const t = setTimeout(async () => {
      const res = await searchNoteOptionsAction(noteQuery);
      if (res.ok) setNoteOptions(res.data);
    }, 150);
    return () => clearTimeout(t);
  }, [noteQuery, linking]);

  if (missing) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        This task no longer exists.
        <Button variant="outline" size="sm" className="mt-3" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }
  if (!task) {
    return (
      <div className="space-y-4 p-5" aria-busy="true">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="space-y-2 pt-4">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </div>
    );
  }

  const save = async (input: Omit<TaskUpdateInput, "id">) => {
    const updated = await act(updateTaskAction({ id: task.id, ...input }));
    if (updated) await load();
  };

  const reminder = task.reminders.find((r) => r.status === "pending");
  const reminderDate = reminder ? isoDateInTz(new Date(reminder.remindAt), settings.tz) : null;
  const reminderTime = reminder ? timeInTz(new Date(reminder.remindAt), settings.tz) : null;
  const setReminder = async (date: string | null, time: string | null) => {
    const at = date ? zonedToInstant(date, time ?? settings.defaultReminderTime, settings.tz).toISOString() : null;
    const ok = await act(setTaskReminderAction(task.id, at), { success: at ? "Reminder set" : "Reminder removed" });
    if (ok !== undefined) await load();
  };

  const done = task.status === "done";

  const breakdown = async () => {
    const res = await ai.run({
      op: "breakdown",
      title: task.title,
      description: task.description.slice(0, 4000),
      existing: task.subtasks.map((s) => s.title),
    });
    if (res) setSuggested(res.subtasks.map((t) => ({ title: t, keep: true })));
  };

  const acceptSuggested = async () => {
    if (!suggested) return;
    const titles = suggested.filter((s) => s.keep && s.title.trim()).map((s) => s.title.trim());
    if (!titles.length) return setSuggested(null);
    const n = await act(addSubtasksAction(task.id, titles), { success: (n) => `Added ${n} subtasks` });
    if (n !== undefined) {
      setSuggested(null);
      await load();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start gap-3 border-b px-5 pt-5 pb-4">
        <TaskCheckbox
          checked={done}
          priority={task.priority}
          label={done ? "Mark as not done" : "Complete task"}
          className="mt-1.5"
          onToggle={async () => {
            const r = await act(setTaskStatusAction(task.id, done ? "todo" : "done"), {
              success: (r) =>
                done ? "Task reopened" : r.next?.dueDate ? `Completed · next on ${relativeDayLabel(r.next.dueDate, today)}` : "Task completed",
            });
            if (r) await load();
          }}
        />
        <div className="min-w-0 flex-1">
          <SheetTitle className="sr-only">Task: {task.title}</SheetTitle>
          <SheetDescription className="sr-only">Edit task details. Changes save automatically.</SheetDescription>
          <label htmlFor="task-title" className="sr-only">
            Title
          </label>
          <textarea
            id="task-title"
            value={title}
            rows={1}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
            onBlur={() => title.trim() && title !== task.title && save({ title: title.trim() })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).blur();
              }
            }}
            className={cn(
              "field-sizing-content w-full resize-none bg-transparent font-display text-xl leading-snug font-semibold outline-none",
              done && "text-muted-foreground line-through",
            )}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Created <TimeAgo date={task.createdAt} />
            {task.completedAt && (
              <>
                {" · Completed "}
                <TimeAgo date={task.completedAt} />
              </>
            )}
          </p>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close task details">
          <X />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <div className="space-y-2.5">
          <FieldRow label="Status" htmlFor="task-status">
            <Select value={task.status} onValueChange={(v) => save({ status: v as TaskDetailDTO["status"] })}>
              <SelectTrigger id="task-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="Priority" htmlFor="task-priority">
            <PrioritySelect id="task-priority" value={task.priority} onChange={(p) => save({ priority: p })} />
          </FieldRow>
          <FieldRow label="Due" htmlFor="task-due">
            <div className="flex gap-2">
              <DateInput id="task-due" value={task.dueDate} onChange={(d) => save({ dueDate: d })} className="flex-1" />
              <TimeInput
                value={task.dueTime}
                onChange={(t) => save({ dueTime: t })}
                disabled={!task.dueDate}
                className="w-28"
                aria-label="Due time"
              />
            </div>
          </FieldRow>
          <FieldRow label="Repeat" htmlFor="task-repeat">
            <RecurrenceSelect id="task-repeat" value={task.recurrence} onChange={(r) => save({ recurrence: r })} />
          </FieldRow>
          <FieldRow label="Reminder" htmlFor="task-reminder">
            <div className="flex gap-2">
              <DateInput
                id="task-reminder"
                value={reminderDate}
                onChange={(d) => setReminder(d, reminderTime)}
                className="flex-1"
              />
              <TimeInput
                value={reminderTime}
                onChange={(t) => setReminder(reminderDate ?? task.dueDate ?? today, t)}
                className="w-28"
                aria-label="Reminder time"
              />
              {reminder && (
                <Button variant="ghost" size="icon" onClick={() => setReminder(null, null)} aria-label="Remove reminder">
                  <BellOff />
                </Button>
              )}
            </div>
          </FieldRow>
          <FieldRow label="Project" htmlFor="task-project">
            <ProjectSelect id="task-project" value={task.project?.id} onChange={(p) => save({ projectId: p })} />
          </FieldRow>
          <FieldRow label="Tags" htmlFor="task-tags">
            <TagInput id="task-tags" value={task.tags.map((t) => t.name)} onChange={(tags) => save({ tags })} />
          </FieldRow>
          <FieldRow label="My Day">
            <Button
              variant={task.myDayDate === today ? "secondary" : "outline"}
              size="sm"
              aria-pressed={task.myDayDate === today}
              onClick={() => save({ myDay: task.myDayDate !== today })}
            >
              <Sun className={cn(task.myDayDate === today && "fill-amber-400 text-amber-500")} />
              {task.myDayDate === today ? "In My Day" : "Add to My Day"}
            </Button>
          </FieldRow>
          {task.inbox && (
            <FieldRow label="Inbox">
              <Button variant="outline" size="sm" onClick={() => save({ inbox: false })}>
                Mark as organized
              </Button>
            </FieldRow>
          )}
        </div>

        <div>
          <label htmlFor="task-description" className="mb-1.5 block text-[0.8rem] text-muted-foreground">
            Notes
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== task.description && save({ description })}
            placeholder="Add details, links or context…"
            className="field-sizing-content min-h-20 w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30"
            maxLength={20000}
          />
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-2">
            <h3 className="text-[0.8rem] text-muted-foreground">
              Subtasks
              {task.subtasks.length > 0 && (
                <span className="ml-1.5 tabular-nums">
                  {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                </span>
              )}
            </h3>
            {aiEnabled && (
              <Button
                variant="ghost"
                size="xs"
                className="ml-auto"
                onClick={ai.loading ? ai.cancel : breakdown}
                aria-label={ai.loading ? "Cancel AI breakdown" : "Suggest subtasks with AI"}
              >
                {ai.loading === "breakdown" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {ai.loading === "breakdown" ? "Cancel" : "Break down"}
              </Button>
            )}
          </div>
          <ul className="space-y-0.5">
            {task.subtasks.map((s) => (
              <li key={s.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1 hover:bg-muted/60">
                <Checkbox
                  checked={s.done}
                  aria-label={`Subtask: ${s.title}`}
                  onCheckedChange={async (v) => {
                    const r = await act(updateSubtaskAction(s.id, { done: v === true }));
                    if (r) await load();
                  }}
                />
                <input
                  defaultValue={s.title}
                  aria-label="Subtask title"
                  onBlur={async (e) => {
                    const v = e.target.value.trim();
                    if (v && v !== s.title) {
                      const r = await act(updateSubtaskAction(s.id, { title: v }));
                      if (r) await load();
                    }
                  }}
                  className={cn("min-w-0 flex-1 bg-transparent text-sm outline-none", s.done && "text-muted-foreground line-through")}
                />
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-60 group-hover:opacity-100"
                  aria-label={`Delete subtask ${s.title}`}
                  onClick={async () => {
                    const r = await act(deleteSubtaskAction(s.id));
                    if (r !== undefined) await load();
                  }}
                >
                  <X />
                </Button>
              </li>
            ))}
          </ul>
          <form
            className="mt-1 flex items-center gap-2.5 px-1"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newSubtask.trim()) return;
              const r = await act(addSubtaskAction(task.id, newSubtask.trim()));
              if (r) {
                setNewSubtask("");
                await load();
              }
            }}
          >
            <Plus className="size-4 text-muted-foreground" aria-hidden />
            <input
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              placeholder="Add subtask"
              aria-label="Add subtask"
              maxLength={300}
              className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </form>

          {suggested && (
            <div className="mt-3 rounded-lg border bg-muted/40 p-3" role="region" aria-label="Suggested subtasks">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Sparkles className="size-3.5" /> Suggested subtasks — review before adding
              </p>
              <ul className="space-y-1.5">
                {suggested.map((s, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Checkbox
                      checked={s.keep}
                      aria-label={`Keep suggestion ${i + 1}`}
                      onCheckedChange={(v) =>
                        setSuggested((prev) => prev!.map((x, j) => (j === i ? { ...x, keep: v === true } : x)))
                      }
                    />
                    <input
                      value={s.title}
                      aria-label={`Suggestion ${i + 1}`}
                      onChange={(e) =>
                        setSuggested((prev) => prev!.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                      }
                      className={cn(fieldInputClass, "h-7")}
                    />
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSuggested(null)}>
                  Discard
                </Button>
                <Button size="sm" onClick={acceptSuggested}>
                  Add selected
                </Button>
              </div>
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-1.5 text-[0.8rem] text-muted-foreground">Linked note</h3>
          {task.note ? (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
              <NotebookPen className="size-4 text-muted-foreground" aria-hidden />
              <Link href={`/notes/${task.note.id}`} onClick={onClose} className="min-w-0 flex-1 truncate text-sm hover:underline">
                {task.note.title || "Untitled note"}
              </Link>
              <Button variant="ghost" size="icon-xs" onClick={() => save({ noteId: null })} aria-label="Unlink note">
                <X />
              </Button>
            </div>
          ) : linking ? (
            <div className="space-y-1.5">
              <input
                autoFocus
                value={noteQuery}
                onChange={(e) => setNoteQuery(e.target.value)}
                placeholder="Search notes…"
                aria-label="Search notes to link"
                className={fieldInputClass}
              />
              <ul className="max-h-40 overflow-y-auto rounded-lg border">
                {noteOptions.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No notes found</li>}
                {noteOptions.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className="w-full truncate px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={async () => {
                        setLinking(false);
                        await save({ noteId: n.id });
                      }}
                    >
                      {n.title || "Untitled note"}
                    </button>
                  </li>
                ))}
              </ul>
              <Button variant="ghost" size="sm" onClick={() => setLinking(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setLinking(true)}>
                Link existing note
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  const note = await act(
                    createNoteAction({
                      title: task.title,
                      content: task.description ? `${task.description}\n` : "",
                      projectId: task.project?.id ?? null,
                    }),
                  );
                  if (!note) return;
                  const linked = await act(updateTaskAction({ id: task.id, noteId: note.id }));
                  if (linked) {
                    onClose();
                    router.push(`/notes/${note.id}`);
                  }
                }}
              >
                <NotebookPen /> Create note
              </Button>
            </div>
          )}
        </div>

        {task.reminders.filter((r) => r.status !== "pending").length > 0 && (
          <div>
            <h3 className="mb-1.5 text-[0.8rem] text-muted-foreground">Reminder history</h3>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {task.reminders
                .filter((r) => r.status !== "pending")
                .slice(0, 5)
                .map((r) => (
                  <li key={r.id} className="flex items-center gap-1.5">
                    <Bell className="size-3" aria-hidden />
                    <DateTime date={r.remindAt} /> · {r.status}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      <div className="pb-safe flex items-center gap-2 border-t px-4 py-3">
        {task.archivedAt ? (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const r = await act(archiveTaskAction(task.id, false), { success: "Task restored" });
              if (r !== undefined) await load();
            }}
          >
            <ArchiveRestore /> Restore
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              const r = await act(archiveTaskAction(task.id, true), { success: "Task archived" });
              if (r !== undefined) onClose();
            }}
          >
            <Archive /> Archive
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={async () => {
            if (
              await confirm({
                title: "Delete this task?",
                description: "This permanently deletes the task, its subtasks and reminders.",
                confirmLabel: "Delete",
                destructive: true,
              })
            ) {
              const r = await act(deleteTaskAction(task.id), { success: "Task deleted" });
              if (r !== undefined) onClose();
            }
          }}
        >
          <Trash2 /> Delete
        </Button>
        <p className="ml-auto text-xs text-muted-foreground">Changes save automatically</p>
      </div>
    </div>
  );
}

export function TaskSheet() {
  const { taskId, closeTask } = useApp();
  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && closeTask()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        {taskId && <TaskDetail key={taskId} taskId={taskId} onClose={closeTask} />}
      </SheetContent>
    </Sheet>
  );
}
