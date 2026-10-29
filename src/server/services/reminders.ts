import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { UserError } from "../action-result";
import { reminderInclude, toReminderDTO } from "../mappers";
import { nextReminderInstant, parseRecurrence, serializeRecurrence } from "@/lib/recurrence";
import { reminderCreateSchema, reminderUpdateSchema } from "@/lib/validation";
import type { ReminderDTO } from "@/lib/types";
import type { z } from "zod";

export async function createReminder(input: z.input<typeof reminderCreateSchema>): Promise<ReminderDTO> {
  const data = reminderCreateSchema.parse(input);
  const r = await db.reminder.create({
    data: {
      title: data.title,
      description: data.description ?? "",
      remindAt: data.remindAt,
      recurrence: serializeRecurrence(data.recurrence),
      taskId: data.taskId ?? null,
      noteId: data.noteId ?? null,
      projectId: data.projectId ?? null,
    },
    include: reminderInclude,
  });
  return toReminderDTO(r);
}

export async function updateReminder(input: z.input<typeof reminderUpdateSchema>): Promise<ReminderDTO> {
  const data = reminderUpdateSchema.parse(input);
  const existing = await db.reminder.findUnique({ where: { id: data.id } });
  if (!existing) throw new UserError("That reminder no longer exists.");
  const update: Prisma.ReminderUpdateInput = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.recurrence !== undefined) update.recurrence = serializeRecurrence(data.recurrence);
  if (data.projectId !== undefined) {
    update.project = data.projectId ? { connect: { id: data.projectId } } : { disconnect: true };
  }
  if (data.remindAt !== undefined && data.remindAt.getTime() !== existing.remindAt.getTime()) {
    // Rescheduling re-arms the reminder so it notifies again at the new time.
    update.remindAt = data.remindAt;
    update.notifiedAt = null;
    update.pushedAt = null;
    update.status = "pending";
    update.completedAt = null;
    update.dismissedAt = null;
  }
  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === "pending") {
      update.completedAt = null;
      update.dismissedAt = null;
    }
  }
  const r = await db.reminder.update({ where: { id: data.id }, data: update, include: reminderInclude });
  return toReminderDTO(r);
}

/**
 * Completes or dismisses a reminder. A recurring reminder is rescheduled to its next
 * occurrence instead; the handled occurrence is kept as history.
 */
export async function resolveReminder(id: string, action: "done" | "dismissed", tz: string) {
  const r = await db.reminder.findUnique({ where: { id } });
  if (!r) throw new UserError("That reminder no longer exists.");
  const now = new Date();
  const rule = parseRecurrence(r.recurrence);
  return db.$transaction(async (tx) => {
    const resolved = await tx.reminder.update({
      where: { id },
      data: {
        status: action,
        completedAt: action === "done" ? now : null,
        dismissedAt: action === "dismissed" ? now : null,
        notifiedAt: r.notifiedAt ?? now,
      },
      include: reminderInclude,
    });
    let next: ReminderDTO | null = null;
    if (rule) {
      const created = await tx.reminder.create({
        data: {
          title: r.title,
          description: r.description,
          remindAt: nextReminderInstant(r.remindAt, rule, tz, now),
          recurrence: r.recurrence,
          taskId: r.taskId,
          noteId: r.noteId,
          projectId: r.projectId,
        },
        include: reminderInclude,
      });
      next = toReminderDTO(created);
    }
    return { reminder: toReminderDTO(resolved), next };
  });
}

export async function snoozeReminder(id: string, minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 7 * 24 * 60) throw new UserError("Invalid snooze duration.");
  const r = await db.reminder.update({
    where: { id },
    data: {
      remindAt: new Date(Date.now() + minutes * 60_000),
      status: "pending",
      notifiedAt: null,
      pushedAt: null,
      snoozeCount: { increment: 1 },
    },
    include: reminderInclude,
  });
  return toReminderDTO(r);
}

export async function deleteReminder(id: string) {
  await db.reminder.delete({ where: { id } });
}

export async function listReminders(view: "upcoming" | "due" | "history" | "all" = "upcoming"): Promise<ReminderDTO[]> {
  const now = new Date();
  const where: Prisma.ReminderWhereInput =
    view === "upcoming"
      ? { status: "pending", remindAt: { gt: now } }
      : view === "due"
        ? { status: "pending", remindAt: { lte: now } }
        : view === "history"
          ? { OR: [{ status: { in: ["done", "dismissed"] } }, { notifiedAt: { not: null } }] }
          : {};
  const rows = await db.reminder.findMany({
    where,
    include: reminderInclude,
    orderBy: { remindAt: view === "history" ? "desc" : "asc" },
    take: 300,
  });
  return rows.map(toReminderDTO);
}

export async function getRemindersInRange(from: Date, to: Date): Promise<ReminderDTO[]> {
  const rows = await db.reminder.findMany({
    where: { remindAt: { gte: from, lt: to }, status: { not: "dismissed" } },
    include: reminderInclude,
    orderBy: { remindAt: "asc" },
  });
  return rows.map(toReminderDTO);
}

/** Pending reminders whose time has come (still awaiting the user's action). */
export async function getDueReminders(): Promise<ReminderDTO[]> {
  const rows = await db.reminder.findMany({
    where: { status: "pending", remindAt: { lte: new Date() } },
    include: reminderInclude,
    orderBy: { remindAt: "asc" },
    take: 50,
  });
  return rows.map(toReminderDTO);
}

/**
 * Atomically claims due reminders that have not yet been announced, so several
 * open tabs or devices don't each show the same notification.
 */
export async function claimDueReminders(): Promise<ReminderDTO[]> {
  const now = new Date();
  const candidates = await db.reminder.findMany({
    where: { status: "pending", remindAt: { lte: now }, notifiedAt: null },
    select: { id: true },
    take: 20,
  });
  const claimed: string[] = [];
  for (const c of candidates) {
    const res = await db.reminder.updateMany({ where: { id: c.id, notifiedAt: null }, data: { notifiedAt: now } });
    if (res.count === 1) claimed.push(c.id);
  }
  if (!claimed.length) return [];
  const rows = await db.reminder.findMany({ where: { id: { in: claimed } }, include: reminderInclude });
  return rows.map(toReminderDTO);
}

export async function nextPendingReminderAt(): Promise<string | null> {
  const r = await db.reminder.findFirst({
    where: { status: "pending", remindAt: { gt: new Date() } },
    orderBy: { remindAt: "asc" },
    select: { remindAt: true },
  });
  return r?.remindAt.toISOString() ?? null;
}

/** Sets or clears the single "primary" reminder of a task (the task's own reminder field). */
export async function setTaskReminder(taskId: string, remindAt: Date | null) {
  const task = await db.task.findUnique({ where: { id: taskId }, select: { title: true } });
  if (!task) throw new UserError("That task no longer exists.");
  const pending = await db.reminder.findFirst({ where: { taskId, status: "pending" }, orderBy: { remindAt: "asc" } });
  if (!remindAt) {
    if (pending) await db.reminder.delete({ where: { id: pending.id } });
    return null;
  }
  if (pending) {
    return updateReminder({ id: pending.id, remindAt, title: task.title });
  }
  return createReminder({ title: task.title, remindAt, taskId });
}
