/**
 * Zod schemas for every mutation that crosses the server boundary.
 * Server actions and route handlers parse their input with these before touching the DB.
 */
import { z } from "zod";
import {
  ACCENTS,
  DATE_FORMATS,
  ITEM_COLORS,
  LIMITS,
  REMINDER_STATUSES,
  TASK_STATUSES,
  THEMES,
  TIME_FORMATS,
} from "./constants";
import { isISODate, isTime, isValidTimezone } from "./dates";
import { recurrenceSchema } from "./recurrence";

export const id = z.string().min(1).max(64);
export const isoDate = z.string().refine(isISODate, "Invalid date (expected YYYY-MM-DD)");
export const timeOfDay = z.string().refine(isTime, "Invalid time (expected HH:mm)");
export const priority = z.number().int().min(0).max(3);
export const title = z.string().trim().min(1, "Title is required").max(LIMITS.title);
export const tagName = z
  .string()
  .trim()
  .min(1)
  .max(LIMITS.tagName)
  .transform((s) => s.replace(/^#/, "").toLowerCase());
export const instant = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), "Invalid date");

export const taskCreateSchema = z.object({
  title,
  description: z.string().max(LIMITS.description).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: priority.optional(),
  dueDate: isoDate.nullish(),
  dueTime: timeOfDay.nullish(),
  myDay: z.boolean().optional(),
  projectId: id.nullish(),
  noteId: id.nullish(),
  tags: z.array(tagName).max(20).optional(),
  recurrence: recurrenceSchema.nullish(),
  subtasks: z.array(z.string().trim().min(1).max(LIMITS.title)).max(LIMITS.subtasks).optional(),
  remindAt: instant.nullish(),
  inbox: z.boolean().optional(),
});
export type TaskCreateInput = z.input<typeof taskCreateSchema>;

export const taskUpdateSchema = z.object({
  id,
  title: title.optional(),
  description: z.string().max(LIMITS.description).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: priority.optional(),
  dueDate: isoDate.nullish(),
  dueTime: timeOfDay.nullish(),
  myDay: z.boolean().optional(),
  projectId: id.nullish(),
  noteId: id.nullish(),
  tags: z.array(tagName).max(20).optional(),
  recurrence: recurrenceSchema.nullish(),
  inbox: z.boolean().optional(),
});
export type TaskUpdateInput = z.input<typeof taskUpdateSchema>;

export const taskFilterSchema = z.object({
  status: z.enum(["open", "todo", "in_progress", "done", "all"]).default("open"),
  priority: z.coerce.number().int().min(0).max(3).optional(),
  projectId: z.string().max(64).optional(),
  tag: z.string().max(LIMITS.tagName).optional(),
  due: z.enum(["any", "overdue", "today", "week", "none", "scheduled"]).default("any"),
  sort: z.enum(["smart", "due", "priority", "created", "updated", "title", "manual"]).default("smart"),
  group: z.enum(["none", "project", "priority", "status", "due"]).default("none"),
  q: z.string().max(LIMITS.searchQuery).optional(),
});
export type TaskFilter = z.infer<typeof taskFilterSchema>;

export const subtaskSchema = z.object({ taskId: id, title });

export const noteCreateSchema = z.object({
  title: z.string().max(LIMITS.title).default(""),
  content: z.string().max(LIMITS.noteContent).default(""),
  projectId: id.nullish(),
  tags: z.array(tagName).max(20).optional(),
  inbox: z.boolean().optional(),
  pinned: z.boolean().optional(),
});

export const noteUpdateSchema = z.object({
  id,
  title: z.string().max(LIMITS.title).optional(),
  content: z.string().max(LIMITS.noteContent).optional(),
  projectId: id.nullish(),
  tags: z.array(tagName).max(20).optional(),
  pinned: z.boolean().optional(),
  inbox: z.boolean().optional(),
});
export type NoteUpdateInput = z.input<typeof noteUpdateSchema>;

/** Body of the autosave endpoint. `baseUpdatedAt` lets the server detect concurrent edits. */
export const noteSaveSchema = z.object({
  title: z.string().max(LIMITS.title),
  content: z.string().max(LIMITS.noteContent),
  baseUpdatedAt: z.string().datetime().optional(),
  force: z.boolean().optional(),
});

export const reminderCreateSchema = z.object({
  title,
  description: z.string().max(LIMITS.description).optional(),
  remindAt: instant,
  recurrence: recurrenceSchema.nullish(),
  taskId: id.nullish(),
  noteId: id.nullish(),
  projectId: id.nullish(),
});

export const reminderUpdateSchema = z.object({
  id,
  title: title.optional(),
  description: z.string().max(LIMITS.description).optional(),
  remindAt: instant.optional(),
  recurrence: recurrenceSchema.nullish(),
  status: z.enum(REMINDER_STATUSES).optional(),
  projectId: id.nullish(),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(LIMITS.projectName),
  description: z.string().max(2000).optional(),
  color: z.enum(ITEM_COLORS).optional(),
  icon: z.string().max(8).nullish(),
});

export const projectUpdateSchema = projectCreateSchema.partial().extend({ id });

export const tagUpdateSchema = z.object({ id, name: tagName.optional(), color: z.enum(ITEM_COLORS).optional() });

export const inboxCreateSchema = z.object({ content: z.string().trim().min(1).max(LIMITS.inboxContent) });

export const dashboardLayoutSchema = z
  .array(z.object({ id: z.string().max(32), visible: z.boolean() }))
  .max(20);

export const settingsUpdateSchema = z.object({
  displayName: z.string().trim().max(60).optional(),
  theme: z.enum(THEMES).optional(),
  accent: z.enum(ACCENTS).optional(),
  timezone: z.string().max(64).refine(isValidTimezone, "Unknown timezone").nullish(),
  weekStart: z.number().int().min(0).max(6).optional(),
  dateFormat: z.enum(DATE_FORMATS).optional(),
  timeFormat: z.enum(TIME_FORMATS).optional(),
  defaultPriority: priority.optional(),
  defaultReminderTime: timeOfDay.optional(),
  defaultSnoozeMinutes: z.number().int().min(1).max(24 * 60).optional(),
  dashboardLayout: dashboardLayoutSchema.optional(),
});
export type SettingsUpdateInput = z.input<typeof settingsUpdateSchema>;

/** Formats a ZodError into one readable sentence for toasts and form errors. */
export function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid input";
  const path = issue.path.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}
