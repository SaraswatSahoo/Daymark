"use server";

import { z } from "zod";
import { run, UserError } from "../action-result";
import { refreshAll, taskContext } from "./context";
import * as reminders from "../services/reminders";
import { db } from "../db";
import { reminderInclude, toReminderDTO } from "../mappers";
import { id, reminderCreateSchema, reminderUpdateSchema } from "@/lib/validation";

export async function createReminderAction(input: z.input<typeof reminderCreateSchema>) {
  return run(async () => {
    const r = await reminders.createReminder(input);
    refreshAll();
    return r;
  });
}

export async function updateReminderAction(input: z.input<typeof reminderUpdateSchema>) {
  return run(async () => {
    const r = await reminders.updateReminder(input);
    refreshAll();
    return r;
  });
}

export async function resolveReminderAction(reminderId: string, action: "done" | "dismissed") {
  return run(async () => {
    const { tz } = await taskContext();
    const r = await reminders.resolveReminder(id.parse(reminderId), z.enum(["done", "dismissed"]).parse(action), tz);
    refreshAll();
    return r;
  });
}

export async function snoozeReminderAction(reminderId: string, minutes: number) {
  return run(async () => {
    const r = await reminders.snoozeReminder(id.parse(reminderId), z.number().int().parse(minutes));
    refreshAll();
    return r;
  });
}

export async function deleteReminderAction(reminderId: string) {
  return run(async () => {
    await reminders.deleteReminder(id.parse(reminderId));
    refreshAll();
  });
}

export async function getReminderAction(reminderId: string) {
  return run(async () => {
    const r = await db.reminder.findUnique({ where: { id: id.parse(reminderId) }, include: reminderInclude });
    if (!r) throw new UserError("That reminder no longer exists.");
    return toReminderDTO(r);
  });
}
