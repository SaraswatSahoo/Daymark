import "server-only";
import { db } from "../db";
import { noteSummaryInclude, reminderInclude, taskInclude, toNoteSummary, toReminderDTO, toTaskDTO } from "../mappers";
import { completedSince, openTaskWhere, sortTasks, type TaskContext } from "./tasks";
import { getInbox } from "./inbox";
import { addDaysISO, isoDateInTz, rangeISO, startOfDayInstant, startOfWeekISO } from "@/lib/dates";

export async function getDashboard(ctx: TaskContext & { weekStart: number }) {
  const now = new Date();
  const weekStart = startOfWeekISO(ctx.today, ctx.weekStart);
  const weekDays = rangeISO(weekStart, 7);
  const weekEnd = weekDays[6];
  const reminderHorizon = new Date(now.getTime() + 3 * 86_400_000);

  const [dueToday, overdue, myDay, completedToday, reminders, recentNotes, inbox, weekTasks, weekReminders] =
    await Promise.all([
      db.task.findMany({ where: { ...openTaskWhere, dueDate: ctx.today }, include: taskInclude }),
      db.task.findMany({ where: { ...openTaskWhere, dueDate: { lt: ctx.today } }, include: taskInclude }),
      db.task.findMany({ where: { ...openTaskWhere, myDayDate: ctx.today }, include: taskInclude }),
      completedSince(ctx),
      db.reminder.findMany({
        where: { status: "pending", remindAt: { lte: reminderHorizon } },
        include: reminderInclude,
        orderBy: { remindAt: "asc" },
        take: 8,
      }),
      db.note.findMany({
        where: { archivedAt: null },
        include: noteSummaryInclude,
        orderBy: { updatedAt: "desc" },
        take: 6,
      }),
      getInbox(),
      db.task.findMany({
        where: { archivedAt: null, dueDate: { gte: weekStart, lte: weekEnd } },
        select: { dueDate: true, status: true },
      }),
      db.reminder.findMany({
        where: {
          status: { not: "dismissed" },
          remindAt: { gte: startOfDayInstant(weekStart, ctx.tz), lt: startOfDayInstant(addDaysISO(weekEnd, 1), ctx.tz) },
        },
        select: { remindAt: true },
      }),
    ]);

  const dueTodayDTO = sortTasks(dueToday.map(toTaskDTO), "smart");
  const overdueDTO = sortTasks(overdue.map(toTaskDTO), "smart");
  const myDayDTO = myDay.map(toTaskDTO);

  // Today's priorities: what's planned for today or overdue, most important first.
  const candidates = new Map<string, ReturnType<typeof toTaskDTO>>();
  for (const t of [...myDayDTO, ...dueTodayDTO, ...overdueDTO]) candidates.set(t.id, t);
  const focus = [...candidates.values()]
    .sort((a, b) => {
      const aMy = a.myDayDate === ctx.today ? 1 : 0;
      const bMy = b.myDayDate === ctx.today ? 1 : 0;
      return b.priority - a.priority || bMy - aMy || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
    })
    .slice(0, 5);

  const plannedOpen = candidates.size;
  const progress = {
    done: completedToday.length,
    total: completedToday.length + plannedOpen,
  };

  const week = weekDays.map((date) => ({
    date,
    tasks: weekTasks.filter((t) => t.dueDate === date).length,
    done: weekTasks.filter((t) => t.dueDate === date && t.status === "done").length,
    reminders: weekReminders.filter((r) => isoDateInTz(r.remindAt, ctx.tz) === date).length,
  }));

  return {
    focus,
    dueToday: dueTodayDTO,
    overdue: overdueDTO,
    completedToday,
    progress,
    reminders: reminders.map(toReminderDTO),
    recentNotes: recentNotes.map(toNoteSummary),
    inbox,
    week,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

/** Data for the weekly review page: real counts only, never fabricated. */
export async function getWeeklyReview(ctx: TaskContext & { weekStart: number }, offsetWeeks = 0) {
  const start = addDaysISO(startOfWeekISO(ctx.today, ctx.weekStart), offsetWeeks * 7);
  const end = addDaysISO(start, 6);
  const from = startOfDayInstant(start, ctx.tz);
  const to = startOfDayInstant(addDaysISO(end, 1), ctx.tz);
  const [completed, open, notes, created] = await Promise.all([
    db.task.findMany({
      where: { status: "done", completedAt: { gte: from, lt: to } },
      include: taskInclude,
      orderBy: { completedAt: "asc" },
    }),
    db.task.findMany({
      where: { ...openTaskWhere, OR: [{ dueDate: { lte: end } }, { myDayDate: { gte: start, lte: end } }] },
      include: taskInclude,
    }),
    db.note.findMany({
      where: { archivedAt: null, updatedAt: { gte: from, lt: to } },
      include: noteSummaryInclude,
      orderBy: { updatedAt: "desc" },
    }),
    db.task.count({ where: { createdAt: { gte: from, lt: to } } }),
  ]);
  return {
    start,
    end,
    completed: completed.map(toTaskDTO),
    open: sortTasks(open.map(toTaskDTO), "smart"),
    notes: notes.map(toNoteSummary),
    createdCount: created,
  };
}
