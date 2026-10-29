"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { TaskRow } from "./task-row";
import { useApp } from "@/components/app/app-context";
import { act } from "@/lib/client/action";
import { createTaskAction, reorderTasksAction } from "@/server/actions/tasks";
import { parseCapture } from "@/lib/capture-parser";
import { PRIORITY_LABELS, STATUS_LABELS, type Priority } from "@/lib/constants";
import { relativeDayLabel } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { TaskDTO } from "@/lib/types";

export type TaskGrouping = "none" | "project" | "priority" | "status" | "due";

function groupTasks(tasks: TaskDTO[], group: TaskGrouping, today: string): { key: string; label: string; tasks: TaskDTO[] }[] {
  if (group === "none") return [{ key: "all", label: "", tasks }];
  const map = new Map<string, { key: string; label: string; order: string; tasks: TaskDTO[] }>();
  for (const t of tasks) {
    let key: string;
    let label: string;
    let order: string;
    switch (group) {
      case "project":
        key = t.project?.id ?? "none";
        label = t.project?.name ?? "No project";
        order = t.project ? `0${t.project.name.toLowerCase()}` : "1";
        break;
      case "priority":
        key = String(t.priority);
        label = PRIORITY_LABELS[t.priority as Priority];
        order = String(9 - t.priority);
        break;
      case "status":
        key = t.status;
        label = STATUS_LABELS[t.status];
        order = { in_progress: "0", todo: "1", done: "2" }[t.status];
        break;
      case "due":
        if (!t.dueDate) {
          key = "none";
          label = "No date";
          order = "9";
        } else if (t.dueDate < today && t.status !== "done") {
          key = "overdue";
          label = "Overdue";
          order = "0";
        } else {
          key = t.dueDate;
          label = relativeDayLabel(t.dueDate, today);
          order = `1${t.dueDate}`;
        }
        break;
    }
    if (!map.has(key)) map.set(key, { key, label, order, tasks: [] });
    map.get(key)!.tasks.push(t);
  }
  return [...map.values()].sort((a, b) => a.order.localeCompare(b.order));
}

export function TaskList({
  tasks,
  group = "none",
  showProject = true,
  showDate = true,
  reorderable = false,
  className,
}: {
  tasks: TaskDTO[];
  group?: TaskGrouping;
  showProject?: boolean;
  showDate?: boolean;
  reorderable?: boolean;
  className?: string;
}) {
  const { today } = useApp();
  const groups = useMemo(() => groupTasks(tasks, group, today), [tasks, group, today]);

  const move = (list: TaskDTO[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    const ids = list.map((t) => t.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void act(reorderTasksAction(ids));
  };

  return (
    <div className={cn("space-y-5", className)}>
      {groups.map((g) => (
        <div key={g.key}>
          {g.label && (
            <h3 className="mb-1 flex items-center gap-2 px-2 text-[0.78rem] font-semibold text-muted-foreground">
              <span className={cn(g.key === "overdue" && "text-destructive")}>{g.label}</span>
              <span className="font-normal tabular-nums text-muted-foreground/70">{g.tasks.length}</span>
            </h3>
          )}
          <ul className="divide-y divide-border/60">
            {g.tasks.map((t, i) => (
              <TaskRow
                key={t.id}
                task={t}
                showProject={showProject}
                showDate={showDate}
                onMove={reorderable ? (d) => move(g.tasks, i, d) : undefined}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Inline "add a task" row that understands the same shorthand as quick capture. */
export function InlineAddTask({
  defaults,
  placeholder = "Add a task",
  className,
}: {
  defaults?: { dueDate?: string; myDay?: boolean; projectId?: string; priority?: number };
  placeholder?: string;
  className?: string;
}) {
  const { settings, projects, today } = useApp();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(
    () => (value.trim() ? parseCapture(value, { timezone: settings.tz, projects }) : null),
    [value, settings.tz, projects],
  );

  const submit = async () => {
    if (!parsed?.title || saving) return;
    setSaving(true);
    const created = await act(
      createTaskAction({
        title: parsed.title,
        dueDate: parsed.date ?? defaults?.dueDate ?? null,
        dueTime: parsed.time ?? null,
        priority: parsed.priority ?? defaults?.priority,
        tags: parsed.tags,
        projectId: parsed.projectId ?? defaults?.projectId ?? null,
        myDay: defaults?.myDay,
      }),
    );
    setSaving(false);
    if (created) setValue("");
  };

  return (
    <form
      className={cn("group flex items-center gap-3 rounded-lg px-2 py-1.5 focus-within:bg-muted/50", className)}
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Plus className="size-5 shrink-0 text-brand" aria-hidden />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        disabled={saving}
        maxLength={300}
        enterKeyHint="done"
        className="h-8 min-w-0 flex-1 bg-transparent text-[0.92rem] outline-none placeholder:text-muted-foreground"
      />
      {parsed?.date && (
        <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand">
          {relativeDayLabel(parsed.date, today)}
          {parsed.time ? ` ${parsed.time}` : ""}
        </span>
      )}
    </form>
  );
}
