import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { UserError } from "../action-result";
import { reminderInclude, taskInclude, toTaskDetailDTO, toTaskDTO } from "../mappers";
import { tagsConnect } from "./tags";
import { addDaysISO, diffDaysISO, startOfDayInstant, startOfWeekISO } from "@/lib/dates";
import { nextTaskDueDate, parseRecurrence, serializeRecurrence } from "@/lib/recurrence";
import {
  subtaskSchema,
  taskCreateSchema,
  taskFilterSchema,
  taskUpdateSchema,
  type TaskCreateInput,
  type TaskFilter,
  type TaskUpdateInput,
} from "@/lib/validation";
import type { TaskDTO, TaskDetailDTO } from "@/lib/types";
import type { TaskStatus } from "@/lib/constants";

export interface TaskContext {
  today: string;
  tz: string;
  weekStart?: number;
  defaultPriority?: number;
}

export const openTaskWhere = { status: { not: "done" }, archivedAt: null } satisfies Prisma.TaskWhereInput;

/** Default ordering: overdue/earliest due first, then priority, then manual order. */
export function smartCompare(a: TaskDTO, b: TaskDTO): number {
  const ad = a.dueDate ? `${a.dueDate} ${a.dueTime ?? "99:99"}` : "9999";
  const bd = b.dueDate ? `${b.dueDate} ${b.dueTime ?? "99:99"}` : "9999";
  if (ad !== bd) return ad < bd ? -1 : 1;
  if (a.priority !== b.priority) return b.priority - a.priority;
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
  return a.createdAt < b.createdAt ? -1 : 1;
}

export function sortTasks(tasks: TaskDTO[], sort: TaskFilter["sort"]): TaskDTO[] {
  const list = [...tasks];
  switch (sort) {
    case "smart":
      return list.sort(smartCompare);
    case "due":
      return list.sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || smartCompare(a, b));
    case "priority":
      return list.sort((a, b) => b.priority - a.priority || smartCompare(a, b));
    case "created":
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "updated":
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case "title":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "manual":
      return list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }
}

export function buildTaskWhere(filter: TaskFilter, ctx: TaskContext): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [{ archivedAt: null }];
  if (filter.status === "open") and.push({ status: { not: "done" } });
  else if (filter.status !== "all") and.push({ status: filter.status });
  if (filter.priority !== undefined) and.push({ priority: filter.priority });
  if (filter.projectId === "none") and.push({ projectId: null });
  else if (filter.projectId) and.push({ projectId: filter.projectId });
  if (filter.tag) and.push({ tags: { some: { name: filter.tag.toLowerCase() } } });
  const weekEnd = addDaysISO(startOfWeekISO(ctx.today, ctx.weekStart ?? 1), 6);
  switch (filter.due) {
    case "overdue":
      and.push({ dueDate: { lt: ctx.today } });
      break;
    case "today":
      and.push({ dueDate: ctx.today });
      break;
    case "week":
      and.push({ dueDate: { gte: ctx.today, lte: weekEnd } });
      break;
    case "none":
      and.push({ dueDate: null });
      break;
    case "scheduled":
      and.push({ dueDate: { not: null } });
      break;
  }
  if (filter.q?.trim()) {
    const q = filter.q.trim();
    and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] });
  }
  return { AND: and };
}

export async function listTasks(rawFilter: Partial<TaskFilter>, ctx: TaskContext): Promise<TaskDTO[]> {
  const filter = taskFilterSchema.parse(rawFilter);
  const rows = await db.task.findMany({
    where: buildTaskWhere(filter, ctx),
    include: taskInclude,
    orderBy: filter.status === "done" ? { completedAt: "desc" } : { createdAt: "asc" },
    take: 1000,
  });
  return sortTasks(rows.map(toTaskDTO), filter.status === "done" && filter.sort === "smart" ? "updated" : filter.sort);
}

export async function getTask(id: string): Promise<TaskDetailDTO | null> {
  const task = await db.task.findUnique({ where: { id }, include: taskInclude });
  if (!task) return null;
  const [subtasks, reminders] = await Promise.all([
    db.subtask.findMany({ where: { taskId: id }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    db.reminder.findMany({ where: { taskId: id }, include: reminderInclude, orderBy: { remindAt: "desc" }, take: 20 }),
  ]);
  return toTaskDetailDTO(
    task,
    subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done })),
    reminders,
  );
}

async function nextSortOrder(): Promise<number> {
  const last = await db.task.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return (last?.sortOrder ?? 0) + 1;
}

export async function createTask(input: TaskCreateInput, ctx: TaskContext): Promise<TaskDTO> {
  const data = taskCreateSchema.parse(input);
  const sortOrder = await nextSortOrder();
  const task = await db.task.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      status: data.status ?? "todo",
      priority: data.priority ?? ctx.defaultPriority ?? 1,
      dueDate: data.dueDate ?? null,
      dueTime: data.dueDate ? (data.dueTime ?? null) : null,
      myDayDate: data.myDay ? ctx.today : null,
      inbox: data.inbox ?? false,
      sortOrder,
      recurrence: serializeRecurrence(data.recurrence),
      completedAt: data.status === "done" ? new Date() : null,
      projectId: data.projectId ?? null,
      noteId: data.noteId ?? null,
      tags: data.tags?.length ? { connectOrCreate: tagsConnect(data.tags) } : undefined,
      subtasks: data.subtasks?.length
        ? { create: data.subtasks.map((title, i) => ({ title, sortOrder: i })) }
        : undefined,
      reminders: data.remindAt ? { create: { title: data.title, remindAt: data.remindAt } } : undefined,
    },
    include: taskInclude,
  });
  return toTaskDTO(task);
}

export async function updateTask(input: TaskUpdateInput, ctx: TaskContext): Promise<TaskDTO> {
  const data = taskUpdateSchema.parse(input);
  const existing = await db.task.findUnique({ where: { id: data.id } });
  if (!existing) throw new UserError("That task no longer exists.");

  const update: Prisma.TaskUpdateInput = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.priority !== undefined) update.priority = data.priority;
  if (data.dueDate !== undefined) {
    update.dueDate = data.dueDate ?? null;
    if (!data.dueDate) update.dueTime = null;
  }
  if (data.dueTime !== undefined && (data.dueDate ?? existing.dueDate)) update.dueTime = data.dueTime ?? null;
  if (data.myDay !== undefined) update.myDayDate = data.myDay ? ctx.today : null;
  if (data.projectId !== undefined) {
    update.project = data.projectId ? { connect: { id: data.projectId } } : { disconnect: true };
  }
  if (data.noteId !== undefined) {
    update.note = data.noteId ? { connect: { id: data.noteId } } : { disconnect: true };
  }
  if (data.recurrence !== undefined) update.recurrence = serializeRecurrence(data.recurrence);
  if (data.tags !== undefined) update.tags = { set: [], connectOrCreate: tagsConnect(data.tags) };
  if (data.inbox !== undefined) update.inbox = data.inbox;
  // Organizing a task (project or date) moves it out of the Inbox.
  else if (existing.inbox && (data.projectId || data.dueDate)) update.inbox = false;

  const task = await db.task.update({ where: { id: data.id }, data: update, include: taskInclude });
  if (data.status !== undefined && data.status !== existing.status) {
    return (await setTaskStatus(data.id, data.status, ctx)).task;
  }
  return toTaskDTO(task);
}

/**
 * Changes a task's status. Completing a recurring task keeps the completed instance
 * as history and creates the next occurrence (once, even if toggled repeatedly).
 */
export async function setTaskStatus(
  id: string,
  status: TaskStatus,
  ctx: TaskContext,
): Promise<{ task: TaskDTO; next: TaskDTO | null }> {
  return db.$transaction(async (tx) => {
    const existing = await tx.task.findUnique({
      where: { id },
      include: { tags: { select: { id: true } }, subtasks: true, reminders: { where: { status: "pending" } } },
    });
    if (!existing) throw new UserError("That task no longer exists.");

    const completing = status === "done" && existing.status !== "done";
    const task = await tx.task.update({
      where: { id },
      data: {
        status,
        completedAt: status === "done" ? (existing.completedAt ?? new Date()) : null,
        inbox: completing ? false : undefined,
      },
      include: taskInclude,
    });

    let next: TaskDTO | null = null;
    if (completing) {
      const rule = parseRecurrence(existing.recurrence);
      const seriesId = existing.seriesId ?? existing.id;
      if (rule) {
        const base = existing.dueDate ?? ctx.today;
        const nextDue = nextTaskDueDate(base, rule, ctx.today);
        const duplicate = await tx.task.findFirst({
          where: { seriesId, status: { not: "done" }, archivedAt: null, dueDate: nextDue, NOT: { id } },
        });
        if (!existing.seriesId) await tx.task.update({ where: { id }, data: { seriesId } });
        if (!duplicate) {
          const shiftMs = diffDaysISO(nextDue, base) * 86_400_000;
          const created = await tx.task.create({
            data: {
              title: existing.title,
              description: existing.description,
              priority: existing.priority,
              dueDate: nextDue,
              dueTime: existing.dueTime,
              recurrence: existing.recurrence,
              seriesId,
              sortOrder: existing.sortOrder,
              projectId: existing.projectId,
              noteId: existing.noteId,
              tags: { connect: existing.tags.map((t) => ({ id: t.id })) },
              subtasks: { create: existing.subtasks.map((s) => ({ title: s.title, sortOrder: s.sortOrder })) },
              reminders: {
                create: existing.reminders.map((r) => ({
                  title: r.title,
                  description: r.description,
                  remindAt: new Date(r.remindAt.getTime() + shiftMs),
                })),
              },
            },
            include: taskInclude,
          });
          next = toTaskDTO(created);
        }
      }
      // A completed task's outstanding reminders are no longer needed.
      await tx.reminder.updateMany({
        where: { taskId: id, status: "pending" },
        data: { status: "done", completedAt: new Date() },
      });
    }
    return { task: toTaskDTO(task), next };
  });
}

export async function archiveTask(id: string, archived: boolean) {
  await db.task.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}

export async function deleteTask(id: string) {
  await db.task.delete({ where: { id } });
}

export async function duplicateTask(id: string, ctx: TaskContext): Promise<TaskDTO> {
  const t = await db.task.findUnique({ where: { id }, include: { tags: true, subtasks: true } });
  if (!t) throw new UserError("That task no longer exists.");
  const created = await db.task.create({
    data: {
      title: `${t.title} (copy)`,
      description: t.description,
      priority: t.priority,
      dueDate: t.dueDate,
      dueTime: t.dueTime,
      myDayDate: t.myDayDate === ctx.today ? ctx.today : null,
      recurrence: t.recurrence,
      projectId: t.projectId,
      noteId: t.noteId,
      sortOrder: t.sortOrder + 0.5,
      tags: { connect: t.tags.map((x) => ({ id: x.id })) },
      subtasks: { create: t.subtasks.map((s) => ({ title: s.title, sortOrder: s.sortOrder })) },
    },
    include: taskInclude,
  });
  return toTaskDTO(created);
}

/** Persists a manual order for the given task ids (e.g. the visible list after a drag or move). */
export async function reorderTasks(ids: string[]) {
  const unique = [...new Set(ids)].slice(0, 1000);
  await db.$transaction(unique.map((id, index) => db.task.update({ where: { id }, data: { sortOrder: index } })));
}

export async function addSubtask(input: { taskId: string; title: string }) {
  const data = subtaskSchema.parse(input);
  const count = await db.subtask.count({ where: { taskId: data.taskId } });
  if (count >= 100) throw new UserError("A task can have at most 100 subtasks.");
  const s = await db.subtask.create({ data: { taskId: data.taskId, title: data.title, sortOrder: count } });
  await db.task.update({ where: { id: data.taskId }, data: { updatedAt: new Date() } });
  return { id: s.id, title: s.title, done: s.done };
}

export async function addSubtasks(taskId: string, titles: string[]) {
  const clean = titles.map((t) => t.trim()).filter(Boolean).slice(0, 20);
  const count = await db.subtask.count({ where: { taskId } });
  if (count + clean.length > 100) throw new UserError("A task can have at most 100 subtasks.");
  await db.subtask.createMany({
    data: clean.map((title, i) => ({ taskId, title: title.slice(0, 300), sortOrder: count + i })),
  });
  return clean.length;
}

export async function updateSubtask(id: string, patch: { title?: string; done?: boolean }) {
  const title = patch.title?.trim();
  if (patch.title !== undefined && !title) throw new UserError("Subtask title is required.");
  const s = await db.subtask.update({
    where: { id },
    data: { title: title?.slice(0, 300), done: patch.done },
  });
  return { id: s.id, title: s.title, done: s.done };
}

export async function deleteSubtask(id: string) {
  await db.subtask.delete({ where: { id } });
}

/* ----------------------------- Views ----------------------------- */

export async function getMyDay(ctx: TaskContext) {
  const [planned, overdue, completedToday] = await Promise.all([
    db.task.findMany({
      where: { ...openTaskWhere, OR: [{ myDayDate: ctx.today }, { dueDate: ctx.today }] },
      include: taskInclude,
    }),
    db.task.findMany({
      // Explicit null branch: SQL `NOT (myDayDate = x)` is NULL (excluded) when myDayDate is NULL.
      where: {
        ...openTaskWhere,
        dueDate: { lt: ctx.today },
        OR: [{ myDayDate: null }, { myDayDate: { not: ctx.today } }],
      },
      include: taskInclude,
    }),
    completedSince(ctx),
  ]);
  return {
    planned: sortTasks(planned.map(toTaskDTO), "smart"),
    overdue: sortTasks(overdue.map(toTaskDTO), "smart"),
    completed: completedToday,
  };
}

/** Tasks completed today in the user's timezone. */
export async function completedSince(ctx: TaskContext): Promise<TaskDTO[]> {
  const rows = await db.task.findMany({
    where: { status: "done", archivedAt: null, completedAt: { gte: startOfDayInstant(ctx.today, ctx.tz) } },
    include: taskInclude,
    orderBy: { completedAt: "desc" },
  });
  return rows.map(toTaskDTO);
}

export async function getUpcomingTasks(ctx: TaskContext, days = 14) {
  const end = addDaysISO(ctx.today, days - 1);
  const [scheduled, overdue] = await Promise.all([
    db.task.findMany({ where: { ...openTaskWhere, dueDate: { gte: ctx.today, lte: end } }, include: taskInclude }),
    db.task.findMany({ where: { ...openTaskWhere, dueDate: { lt: ctx.today } }, include: taskInclude }),
  ]);
  return {
    scheduled: sortTasks(scheduled.map(toTaskDTO), "smart"),
    overdue: sortTasks(overdue.map(toTaskDTO), "smart"),
    end,
  };
}

export async function getTasksInRange(from: string, to: string, includeDone = true): Promise<TaskDTO[]> {
  const rows = await db.task.findMany({
    where: {
      archivedAt: null,
      dueDate: { gte: from, lte: to },
      ...(includeDone ? {} : { status: { not: "done" } }),
    },
    include: taskInclude,
  });
  return sortTasks(rows.map(toTaskDTO), "smart");
}

export async function getCompletedTasks(limit = 300): Promise<TaskDTO[]> {
  const rows = await db.task.findMany({
    where: { status: "done", archivedAt: null },
    include: taskInclude,
    orderBy: { completedAt: "desc" },
    take: limit,
  });
  return rows.map(toTaskDTO);
}

export async function listTaskOptions(query: string, limit = 20) {
  return db.task.findMany({
    where: { archivedAt: null, ...(query ? { title: { contains: query, mode: "insensitive" } } : {}) },
    select: { id: true, title: true, status: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}
