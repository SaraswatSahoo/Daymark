"use client";

import Link from "next/link";
import { ArrowRight, Bell, CalendarCheck2, Inbox, Lightbulb, NotebookPen, Pin, Plus, Sun, TriangleAlert } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { TaskList } from "@/components/tasks/task-list";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { DashboardCapture } from "./dashboard-capture";
import { ReminderRow } from "@/components/reminders/reminder-row";
import { formatISO, parseISODateUTCAsLocal } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { DashboardSectionId } from "@/lib/constants";
import type { NoteSummaryDTO, ReminderDTO, TaskDTO, InboxItemDTO } from "@/lib/types";
import { TimeAgo } from "@/components/common/time";

export interface DashboardProps {
  greeting: string;
  focus: TaskDTO[];
  dueToday: TaskDTO[];
  overdue: TaskDTO[];
  progress: { done: number; total: number };
  reminders: ReminderDTO[];
  recentNotes: NoteSummaryDTO[];
  inbox: { ideas: InboxItemDTO[]; tasks: TaskDTO[]; notes: NoteSummaryDTO[]; count: number };
  week: { date: string; tasks: number; done: number; reminders: number }[];
}

function Panel({
  title,
  icon: Icon,
  href,
  linkLabel = "View all",
  children,
  className,
  tone,
}: {
  title: string;
  icon: typeof Sun;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
  className?: string;
  tone?: "danger";
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border bg-card p-3 shadow-xs sm:p-4", className)}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <Icon className={cn("size-4", tone === "danger" ? "text-destructive" : "text-muted-foreground")} aria-hidden />
        <h2 className="text-sm font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="ml-auto inline-flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground">
            {linkLabel} <ArrowRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`Today's progress: ${done} of ${total} tasks done`}>
      <svg viewBox="0 0 56 56" className="size-14 -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          strokeWidth="5"
          strokeLinecap="round"
          className="stroke-brand transition-[stroke-dashoffset] duration-500"
          strokeDasharray={c}
          strokeDashoffset={c - (c * pct) / 100}
        />
      </svg>
      <div>
        <p className="text-2xl font-semibold tabular-nums leading-none">
          {done}
          <span className="text-base font-normal text-muted-foreground">/{total}</span>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{total === 0 ? "Nothing planned yet" : pct === 100 ? "All done today 🎉" : "done today"}</p>
      </div>
    </div>
  );
}

export function DashboardView(props: DashboardProps) {
  const { settings, today, openCapture, openReminder } = useApp();
  const sections = settings.dashboardLayout.filter((s) => s.visible).map((s) => s.id as DashboardSectionId);

  const render = (id: DashboardSectionId) => {
    switch (id) {
      case "focus":
        return (
          <Panel key={id} title="Today's priorities" icon={Sun} href="/today" linkLabel="My Day" className="lg:col-span-2">
            {props.focus.length ? (
              <TaskList tasks={props.focus} />
            ) : (
              <EmptyState compact icon={Sun} title="A clear day" description="Add tasks to My Day or set due dates to see them here.">
                <Button size="sm" variant="outline" onClick={() => openCapture({ kind: "task", myDay: true })}>
                  <Plus /> Plan a task for today
                </Button>
              </EmptyState>
            )}
          </Panel>
        );
      case "overdue":
        return props.overdue.length ? (
          <Panel key={id} title={`Overdue · ${props.overdue.length}`} icon={TriangleAlert} tone="danger" href="/tasks?due=overdue">
            <TaskList tasks={props.overdue.slice(0, 6)} />
          </Panel>
        ) : null;
      case "today":
        return (
          <Panel key={id} title="Due today" icon={CalendarCheck2} href="/tasks?due=today">
            {props.dueToday.length ? (
              <TaskList tasks={props.dueToday.slice(0, 8)} showDate={false} />
            ) : (
              <EmptyState compact icon={CalendarCheck2} title="Nothing due today" />
            )}
          </Panel>
        );
      case "reminders":
        return (
          <Panel key={id} title="Upcoming reminders" icon={Bell} href="/reminders">
            {props.reminders.length ? (
              <ul className="divide-y divide-border/60">
                {props.reminders.map((r) => (
                  <ReminderRow key={r.id} reminder={r} compact />
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Bell} title="No reminders in the next few days">
                <Button size="sm" variant="outline" onClick={() => openReminder({})}>
                  <Plus /> Set a reminder
                </Button>
              </EmptyState>
            )}
          </Panel>
        );
      case "week":
        return (
          <Panel key={id} title="This week" icon={CalendarCheck2} href="/calendar?view=week" linkLabel="Calendar" className="lg:col-span-2">
            <ol className="grid grid-cols-7 gap-1">
              {props.week.map((d) => {
                const local = parseISODateUTCAsLocal(d.date);
                const isToday = d.date === today;
                const past = d.date < today;
                return (
                  <li key={d.date}>
                    <Link
                      href={`/calendar?view=day&date=${d.date}`}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-lg px-0.5 py-2 text-center transition-colors hover:bg-muted",
                        isToday && "bg-brand-soft hover:bg-brand-soft",
                      )}
                      aria-label={`${format(local, "EEEE, MMMM d")}: ${d.tasks} tasks, ${d.reminders} reminders`}
                    >
                      <span className={cn("text-[0.68rem] uppercase text-muted-foreground", isToday && "font-semibold text-brand")}>
                        {format(local, "EEE")}
                      </span>
                      <span className={cn("text-lg font-semibold tabular-nums leading-none", past && !isToday && "text-muted-foreground")}>
                        {format(local, "d")}
                      </span>
                      <span className="flex h-2 items-center gap-0.5" aria-hidden>
                        {Array.from({ length: Math.min(d.tasks, 4) }, (_, i) => (
                          <span key={i} className={cn("size-1.5 rounded-full", i < d.done ? "bg-success" : "bg-brand/70")} />
                        ))}
                        {d.reminders > 0 && <span className="size-1.5 rounded-full bg-warning" />}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Panel>
        );
      case "notes":
        return (
          <Panel key={id} title="Recently edited notes" icon={NotebookPen} href="/notes">
            {props.recentNotes.length ? (
              <ul className="space-y-0.5">
                {props.recentNotes.map((n) => (
                  <li key={n.id}>
                    <Link href={`/notes/${n.id}`} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 hover:bg-muted">
                      {n.pinned ? <Pin className="size-3.5 shrink-0 text-brand" aria-label="Pinned" /> : <NotebookPen className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate text-sm">{n.title || "Untitled"}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        <TimeAgo date={n.updatedAt} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={NotebookPen} title="No notes yet">
                <Button size="sm" variant="outline" onClick={() => openCapture({ kind: "note" })}>
                  <Plus /> Write a note
                </Button>
              </EmptyState>
            )}
          </Panel>
        );
      case "inbox": {
        const items = [
          ...props.inbox.ideas.map((i) => ({ id: i.id, label: i.content.split("\n")[0], icon: Lightbulb, href: "/inbox" })),
          ...props.inbox.tasks.map((t) => ({ id: t.id, label: t.title, icon: CalendarCheck2, href: "/inbox" })),
          ...props.inbox.notes.map((n) => ({ id: n.id, label: n.title || "Untitled note", icon: NotebookPen, href: `/notes/${n.id}` })),
        ].slice(0, 5);
        return (
          <Panel key={id} title={`Inbox${props.inbox.count ? ` · ${props.inbox.count}` : ""}`} icon={Inbox} href="/inbox" linkLabel="Process">
            {items.length ? (
              <ul className="space-y-0.5">
                {items.map((i) => (
                  <li key={i.id}>
                    <Link href={i.href} className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-sm hover:bg-muted">
                      <i.icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">{i.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Inbox} title="Inbox zero" description="Everything is organized." />
            )}
          </Panel>
        );
      }
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:px-8 lg:pt-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{formatISO(today, "EEEE, MMMM d")}</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-[2.25rem]">
            {props.greeting}
            {settings.displayName ? `, ${settings.displayName}` : ""}
          </h1>
        </div>
        <ProgressRing done={props.progress.done} total={props.progress.total} />
      </header>

      <div className="mb-6">
        <DashboardCapture />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">{sections.map(render)}</div>
      {sections.length === 0 && (
        <EmptyState icon={Sun} title="Your dashboard is empty" description="Turn sections back on in Settings → Dashboard.">
          <Button asChild variant="outline" size="sm">
            <Link href="/settings#dashboard">Open settings</Link>
          </Button>
        </EmptyState>
      )}
    </div>
  );
}
