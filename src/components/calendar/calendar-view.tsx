"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Bell, CalendarDays, ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { TaskList } from "@/components/tasks/task-list";
import { ReminderRow } from "@/components/reminders/reminder-row";
import {
  addDaysISO,
  addMonthsISO,
  formatTime,
  isoDateInTz,
  parseISODateUTCAsLocal,
  rangeISO,
  relativeDayLabel,
  timeInTz,
} from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ReminderDTO, TaskDTO } from "@/lib/types";

export type CalendarViewMode = "month" | "week" | "day";

interface DayItems {
  tasks: TaskDTO[];
  reminders: ReminderDTO[];
}

function href(view: CalendarViewMode, date: string) {
  return `/calendar?view=${view}&date=${date}`;
}

function ItemChip({ label, time, kind, done, onClick }: { label: string; time?: string | null; kind: "task" | "reminder"; done?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded px-1 py-px text-left text-[0.7rem] leading-tight transition-colors",
        kind === "task" ? "bg-brand-soft text-foreground hover:bg-brand/20" : "bg-warning/15 text-foreground hover:bg-warning/25",
        done && "opacity-50 line-through",
      )}
    >
      {kind === "reminder" ? <Bell className="size-2.5 shrink-0 text-warning" aria-hidden /> : <span className="size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />}
      {time && <span className="shrink-0 tabular-nums text-muted-foreground">{time}</span>}
      <span className="truncate">{label}</span>
      <span className="sr-only">{kind === "reminder" ? "(reminder)" : done ? "(task, done)" : "(task)"}</span>
    </button>
  );
}

function Agenda({ date, items }: { date: string; items: DayItems }) {
  const { today, openCapture, openReminder } = useApp();
  const pending = items.reminders.filter((r) => r.status !== "dismissed");
  const empty = !items.tasks.length && !pending.length;
  return (
    <section aria-labelledby={`agenda-${date}`} className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center gap-2 px-2">
        <h2 id={`agenda-${date}`} className="font-display text-lg font-semibold">
          {relativeDayLabel(date, today)}
          <span className="ml-2 text-sm font-normal text-muted-foreground">{format(parseISODateUTCAsLocal(date), "EEEE, MMM d")}</span>
        </h2>
        <div className="ml-auto flex gap-1">
          <Button variant="outline" size="xs" onClick={() => openReminder({ date })}>
            <Bell /> Reminder
          </Button>
          <Button size="xs" onClick={() => openCapture({ kind: "task", date })}>
            <Plus /> Task
          </Button>
        </div>
      </div>
      {empty ? (
        <EmptyState compact icon={CalendarDays} title="Nothing scheduled" />
      ) : (
        <>
          {pending.length > 0 && (
            <ul>
              {pending.map((r) => (
                <ReminderRow key={r.id} reminder={r} />
              ))}
            </ul>
          )}
          {items.tasks.length > 0 && <TaskList tasks={items.tasks} showDate={false} />}
        </>
      )}
    </section>
  );
}

export function CalendarView({
  view,
  date,
  from,
  days,
  tasks,
  reminders,
}: {
  view: CalendarViewMode;
  date: string;
  from: string;
  days: number;
  tasks: TaskDTO[];
  reminders: ReminderDTO[];
}) {
  const { settings, today, openTask, openReminder } = useApp();
  const router = useRouter();
  const range = useMemo(() => rangeISO(from, days), [from, days]);

  const byDay = useMemo(() => {
    const map = new Map<string, DayItems>();
    for (const d of range) map.set(d, { tasks: [], reminders: [] });
    for (const t of tasks) if (t.dueDate) map.get(t.dueDate)?.tasks.push(t);
    for (const r of reminders) map.get(isoDateInTz(new Date(r.remindAt), settings.tz))?.reminders.push(r);
    for (const v of map.values()) {
      v.tasks.sort((a, b) => (a.dueTime ?? "").localeCompare(b.dueTime ?? ""));
      v.reminders.sort((a, b) => a.remindAt.localeCompare(b.remindAt));
    }
    return map;
  }, [range, tasks, reminders, settings.tz]);

  const prev = view === "month" ? addMonthsISO(date, -1) : addDaysISO(date, view === "week" ? -7 : -1);
  const next = view === "month" ? addMonthsISO(date, 1) : addDaysISO(date, view === "week" ? 7 : 1);
  const title =
    view === "month"
      ? format(parseISODateUTCAsLocal(date), "MMMM yyyy")
      : view === "week"
        ? `${format(parseISODateUTCAsLocal(range[0]), "MMM d")} – ${format(parseISODateUTCAsLocal(range[6]), range[0].slice(5, 7) === range[6].slice(5, 7) ? "d, yyyy" : "MMM d, yyyy")}`
        : format(parseISODateUTCAsLocal(date), "EEEE, MMMM d");
  const weekdays = range.slice(0, 7).map((d) => format(parseISODateUTCAsLocal(d), "EEE"));
  const month = date.slice(0, 7);
  const selected = byDay.get(date) ?? { tasks: [], reminders: [] };
  const fmt = (t: string) => formatTime(t, settings.timeFormat);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:pt-10">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-[1.75rem] leading-tight font-semibold tracking-tight sm:text-[2rem]">{title}</h1>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Previous">
            <Link href={href(view, prev)} scroll={false}>
              <ChevronLeft />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={href(view, today)} scroll={false}>
              Today
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" aria-label="Next">
            <Link href={href(view, next)} scroll={false}>
              <ChevronRight />
            </Link>
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div role="tablist" aria-label="Calendar view" className="flex rounded-lg border p-0.5">
            {(["month", "week", "day"] as const).map((v) => (
              <Link
                key={v}
                role="tab"
                aria-selected={view === v}
                href={href(v, date)}
                scroll={false}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground hover:text-foreground",
                  view === v && "bg-muted text-foreground",
                )}
              >
                {v}
              </Link>
            ))}
          </div>
          <Button asChild variant="ghost" size="icon-sm" aria-label="Export calendar (.ics)" title="Export to calendar app (.ics)">
            <a href="/api/export?format=ics" download>
              <Download />
            </a>
          </Button>
        </div>
      </header>

      {view === "month" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs">
            <div className="grid grid-cols-7 border-b bg-muted/40">
              {weekdays.map((w) => (
                <div key={w} className="py-2 text-center text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
                  <span className="sm:hidden">{w.slice(0, 1)}</span>
                  <span className="hidden sm:inline">{w}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {range.map((d) => {
                const items = byDay.get(d)!;
                const inMonth = d.slice(0, 7) === month;
                const isToday = d === today;
                const isSelected = d === date;
                const pending = items.reminders.filter((r) => r.status === "pending");
                const all = [
                  ...pending.map((r) => ({ kind: "reminder" as const, id: r.id, label: r.title, time: fmt(timeInTz(new Date(r.remindAt), settings.tz)), done: false })),
                  ...items.tasks.map((t) => ({ kind: "task" as const, id: t.id, label: t.title, time: t.dueTime ? fmt(t.dueTime) : null, done: t.status === "done" })),
                ];
                const count = all.length;
                return (
                  <div
                    key={d}
                    role="button"
                    tabIndex={0}
                    aria-label={`${format(parseISODateUTCAsLocal(d), "EEEE, MMMM d")}: ${items.tasks.length} tasks, ${pending.length} reminders`}
                    aria-pressed={isSelected}
                    onClick={() => router.replace(href("month", d), { scroll: false })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.replace(href("month", d), { scroll: false });
                      }
                    }}
                    className={cn(
                      "group relative min-h-14 cursor-pointer border-r border-b p-1 text-left outline-none transition-colors last:border-r-0 hover:bg-muted/50 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-24 [&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-muted/30 text-muted-foreground",
                      isSelected && "bg-brand-soft/60 hover:bg-brand-soft/80",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums",
                        isToday && "bg-brand font-semibold text-brand-foreground",
                      )}
                    >
                      {Number(d.slice(8))}
                    </span>
                    {/* Narrow screens: dots only. */}
                    <span className="mt-0.5 flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden>
                      {all.slice(0, 3).map((i) => (
                        <span key={i.id} className={cn("size-1.5 rounded-full", i.kind === "task" ? (i.done ? "bg-success" : "bg-brand") : "bg-warning")} />
                      ))}
                    </span>
                    <span className="mt-0.5 hidden space-y-0.5 sm:block">
                      {all.slice(0, 3).map((i) => (
                        <ItemChip
                          key={i.id}
                          label={i.label}
                          time={i.time}
                          kind={i.kind}
                          done={i.done}
                          onClick={() => (i.kind === "task" ? openTask(i.id) : openReminder({ id: i.id }))}
                        />
                      ))}
                      {count > 3 && <span className="block px-1 text-[0.68rem] text-muted-foreground">+{count - 3} more</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Agenda date={date} items={selected} />
          </div>
        </div>
      )}

      {view === "week" && (
        <div className="grid gap-3 md:grid-cols-7 md:gap-0 md:overflow-hidden md:rounded-xl md:border md:bg-card md:shadow-xs">
          {range.map((d) => {
            const items = byDay.get(d)!;
            const isToday = d === today;
            const pending = items.reminders.filter((r) => r.status === "pending");
            return (
              <section key={d} className="min-w-0 rounded-xl border bg-card p-2 md:min-h-[24rem] md:rounded-none md:border-0 md:border-r md:last:border-r-0" aria-label={format(parseISODateUTCAsLocal(d), "EEEE, MMMM d")}>
                <Link href={href("day", d)} className="mb-2 flex items-baseline gap-1.5 rounded px-1 hover:bg-muted md:flex-col md:items-center md:gap-0">
                  <span className={cn("text-[0.7rem] uppercase text-muted-foreground", isToday && "font-semibold text-brand")}>
                    {format(parseISODateUTCAsLocal(d), "EEE")}
                  </span>
                  <span className={cn("text-lg font-semibold tabular-nums", isToday && "text-brand")}>{Number(d.slice(8))}</span>
                </Link>
                <div className="space-y-1">
                  {pending.map((r) => (
                    <ItemChip key={r.id} kind="reminder" label={r.title} time={fmt(timeInTz(new Date(r.remindAt), settings.tz))} onClick={() => openReminder({ id: r.id })} />
                  ))}
                  {items.tasks.map((t) => (
                    <ItemChip key={t.id} kind="task" label={t.title} time={t.dueTime ? fmt(t.dueTime) : null} done={t.status === "done"} onClick={() => openTask(t.id)} />
                  ))}
                  {!pending.length && !items.tasks.length && <p className="px-1 text-xs text-muted-foreground/70 md:text-center">—</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {view === "day" && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <Agenda date={date} items={selected} />
          <aside aria-label="Next few days" className="space-y-4">
            <h2 className="px-2 text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">Coming up</h2>
            {range.slice(1).map((d) => {
              const items = byDay.get(d)!;
              const pending = items.reminders.filter((r) => r.status === "pending");
              if (!items.tasks.length && !pending.length) return null;
              return (
                <div key={d}>
                  <Link href={href("day", d)} className="block px-2 text-sm font-medium hover:underline">
                    {relativeDayLabel(d, today)}
                  </Link>
                  <div className="mt-1 space-y-1 px-1">
                    {pending.map((r) => (
                      <ItemChip key={r.id} kind="reminder" label={r.title} time={fmt(timeInTz(new Date(r.remindAt), settings.tz))} onClick={() => openReminder({ id: r.id })} />
                    ))}
                    {items.tasks.map((t) => (
                      <ItemChip key={t.id} kind="task" label={t.title} time={t.dueTime ? fmt(t.dueTime) : null} done={t.status === "done"} onClick={() => openTask(t.id)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </aside>
        </div>
      )}

      <p className="mt-6 flex flex-wrap items-center gap-4 px-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brand" aria-hidden /> Task
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" aria-hidden /> Completed
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Bell className="size-3 text-warning" aria-hidden /> Reminder
        </span>
      </p>
    </div>
  );
}
