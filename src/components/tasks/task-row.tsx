"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Archive,
  Bell,
  CalendarDays,
  CalendarX,
  Copy,
  Flag,
  ListChecks,
  MoreHorizontal,
  NotebookPen,
  Repeat,
  Sun,
  Trash2,
} from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { useConfirm } from "@/components/common/confirm";
import { PriorityFlag, TagChip } from "@/components/common/fields";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TaskCheckbox } from "./task-checkbox";
import { useTaskActions } from "./use-task-actions";
import { addDaysISO, formatInstant, formatTime, relativeDayLabel, startOfWeekISO } from "@/lib/dates";
import { colorClasses, PRIORITY_STYLES } from "@/lib/colors";
import { PRIORITY_LABELS, type Priority } from "@/lib/constants";
import { describeRecurrence } from "@/lib/recurrence";
import { cn } from "@/lib/utils";
import type { TaskDTO } from "@/lib/types";

export interface TaskRowOptions {
  showProject?: boolean;
  showDate?: boolean;
  onMove?: (direction: -1 | 1) => void;
}

export function DueLabel({ task, today, timeFormat }: { task: TaskDTO; today: string; timeFormat: string }) {
  if (!task.dueDate) return null;
  const overdue = task.status !== "done" && task.dueDate < today;
  const isToday = task.dueDate === today;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        overdue ? "text-destructive" : isToday ? "font-medium text-brand" : "text-muted-foreground",
      )}
    >
      <CalendarDays className="size-3" aria-hidden />
      {relativeDayLabel(task.dueDate, today)}
      {task.dueTime ? `, ${formatTime(task.dueTime, timeFormat)}` : ""}
      {overdue && <span className="sr-only">(overdue)</span>}
    </span>
  );
}

export function TaskRow({ task, showProject = true, showDate = true, onMove }: { task: TaskDTO } & TaskRowOptions) {
  const { today, settings, openTask } = useApp();
  const actions = useTaskActions();
  const confirm = useConfirm();
  // Optimistic completion; ignored as soon as the server-rendered status changes.
  const [pending, setPending] = useState<{ base: string; done: boolean } | null>(null);
  const done = pending && pending.base === task.status ? pending.done : task.status === "done";
  const inMyDay = task.myDayDate === today;

  const toggle = async () => {
    const next = !done;
    setPending({ base: task.status, done: next });
    const ok = await actions.setDone(task, next);
    if (!ok) setPending(null);
  };

  const hasMeta =
    (showDate && task.dueDate) ||
    task.recurrence ||
    task.subtaskCount > 0 ||
    task.nextReminderAt ||
    (showProject && task.project) ||
    task.tags.length > 0 ||
    task.note ||
    task.status === "in_progress";

  const weekStart = startOfWeekISO(today, settings.weekStart);

  return (
    <li
      className={cn(
        "group/row relative flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60 focus-within:bg-muted/60",
        done && "opacity-60",
      )}
    >
      <TaskCheckbox
        checked={done}
        priority={task.priority}
        onToggle={toggle}
        label={done ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        className="mt-0.5"
      />
      <button
        type="button"
        onClick={() => openTask(task.id)}
        className="min-w-0 flex-1 text-left outline-none"
        aria-label={`Open task: ${task.title}`}
      >
        <span className="flex items-start gap-1.5">
          <span
            className={cn(
              "min-w-0 break-words text-[0.92rem] leading-snug transition-colors",
              done && "text-muted-foreground line-through decoration-muted-foreground/60",
            )}
          >
            {task.title}
          </span>
          <PriorityFlag priority={task.priority} className="mt-0.5" />
        </span>
        {hasMeta && (
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[0.74rem] text-muted-foreground">
            {task.status === "in_progress" && (
              <span className="rounded bg-brand-soft px-1.5 font-medium text-brand">In progress</span>
            )}
            {showDate && <DueLabel task={task} today={today} timeFormat={settings.timeFormat} />}
            {task.recurrence && (
              <span className="inline-flex items-center gap-1" title={describeRecurrence(task.recurrence)}>
                <Repeat className="size-3" aria-hidden />
                <span className="sr-only">{describeRecurrence(task.recurrence)}</span>
              </span>
            )}
            {task.nextReminderAt && (
              <span className="inline-flex items-center gap-1">
                <Bell className="size-3" aria-hidden />
                {formatInstant(new Date(task.nextReminderAt), settings.tz, today, settings.timeFormat)}
              </span>
            )}
            {task.subtaskCount > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <ListChecks className="size-3" aria-hidden />
                {task.subtaskDone}/{task.subtaskCount}
              </span>
            )}
            {task.note && (
              <span className="inline-flex max-w-[10rem] items-center gap-1">
                <NotebookPen className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{task.note.title || "Untitled note"}</span>
              </span>
            )}
            {showProject && task.project && (
              <span className="inline-flex max-w-[10rem] items-center gap-1.5">
                <span className={cn("size-1.5 shrink-0 rounded-full", colorClasses(task.project.color).dot)} aria-hidden />
                <span className="truncate">{task.project.name}</span>
              </span>
            )}
            {task.tags.map((t) => (
              <TagChip key={t.id} name={t.name} color={t.color} className="h-4 text-[0.68rem]" />
            ))}
          </span>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100 [@media(pointer:coarse)]:opacity-100">
        {!done && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void actions.toggleMyDay(task)}
            aria-label={inMyDay ? "Remove from My Day" : "Add to My Day"}
            aria-pressed={inMyDay}
            className={cn("hidden sm:inline-flex", inMyDay && "text-amber-500 hover:text-amber-600")}
          >
            <Sun className={cn(inMyDay && "fill-current")} />
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`More actions for ${task.title}`}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => openTask(task.id)}>Open details</DropdownMenuItem>
            {!done && (
              <DropdownMenuItem onSelect={() => void actions.toggleMyDay(task)}>
                <Sun /> {inMyDay ? "Remove from My Day" : "Add to My Day"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CalendarDays /> Due date
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onSelect={() => void actions.update({ id: task.id, dueDate: today }, "Due today")}>Today</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void actions.update({ id: task.id, dueDate: addDaysISO(today, 1) }, "Due tomorrow")}>
                  Tomorrow
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => void actions.update({ id: task.id, dueDate: addDaysISO(weekStart, 7) }, "Due next week")}
                >
                  Next week
                </DropdownMenuItem>
                {task.dueDate && (
                  <DropdownMenuItem onSelect={() => void actions.update({ id: task.id, dueDate: null }, "Due date removed")}>
                    <CalendarX /> No date
                  </DropdownMenuItem>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Flag /> Priority
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {[3, 2, 1, 0].map((p) => (
                  <DropdownMenuItem key={p} onSelect={() => void actions.update({ id: task.id, priority: p })}>
                    <Flag className={cn(PRIORITY_STYLES[p].flag, p >= 2 && "fill-current")} />
                    {PRIORITY_LABELS[p as Priority]}
                    {task.priority === p && <span className="ml-auto text-xs text-muted-foreground">current</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            {onMove && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onMove(-1)}>
                  <ArrowUp /> Move up
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMove(1)}>
                  <ArrowDown /> Move down
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => void actions.duplicate(task)}>
              <Copy /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => void actions.archive(task)}>
              <Archive /> Archive
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={async () => {
                if (
                  await confirm({
                    title: "Delete this task?",
                    description: `“${task.title}” and its subtasks will be permanently deleted. Archive it instead to keep a record.`,
                    confirmLabel: "Delete",
                    destructive: true,
                  })
                )
                  void actions.remove(task);
              }}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
