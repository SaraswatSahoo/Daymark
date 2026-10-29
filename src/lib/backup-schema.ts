import { z } from "zod";

/** Version of the JSON backup format. Bump when the shape changes and add a migration in `parseBackup`. */
export const BACKUP_VERSION = 1;

const dateStr = z.string().datetime({ offset: true });
const nullableDate = dateStr.nullable().optional().default(null);
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const backupSchema = z.object({
  app: z.literal("daymark"),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  exportedAt: dateStr,
  data: z.object({
    settings: z
      .object({
        displayName: z.string().max(60),
        theme: z.string().max(10),
        accent: z.string().max(20),
        timezone: z.string().max(64).nullable(),
        weekStart: z.number().int().min(0).max(6),
        dateFormat: z.string().max(20),
        timeFormat: z.string().max(4),
        defaultPriority: z.number().int().min(0).max(3),
        defaultReminderTime: z.string().max(5),
        defaultSnoozeMinutes: z.number().int().min(1).max(1440),
        dashboardLayout: z.string().max(4000),
      })
      .partial()
      .nullable()
      .optional(),
    projects: z.array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(200),
        description: z.string().max(5000).default(""),
        color: z.string().max(20).default("slate"),
        icon: z.string().max(8).nullable().default(null),
        sortOrder: z.number().default(0),
        archivedAt: nullableDate,
        createdAt: dateStr,
        updatedAt: dateStr,
      }),
    ),
    tags: z.array(
      z.object({
        id: z.string().min(1).max(64),
        name: z.string().min(1).max(60),
        color: z.string().max(20).default("slate"),
        createdAt: dateStr,
      }),
    ),
    notes: z.array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().max(500).default(""),
        content: z.string().max(1_000_000).default(""),
        pinned: z.boolean().default(false),
        inbox: z.boolean().default(false),
        journalDate: isoDay.nullable().default(null),
        archivedAt: nullableDate,
        createdAt: dateStr,
        updatedAt: dateStr,
        projectId: z.string().max(64).nullable().default(null),
        tagIds: z.array(z.string().max(64)).default([]),
      }),
    ),
    tasks: z.array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().min(1).max(500),
        description: z.string().max(50_000).default(""),
        status: z.enum(["todo", "in_progress", "done"]),
        priority: z.number().int().min(0).max(3),
        dueDate: isoDay.nullable().default(null),
        dueTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
        myDayDate: isoDay.nullable().default(null),
        inbox: z.boolean().default(false),
        sortOrder: z.number().default(0),
        recurrence: z.string().max(200).nullable().default(null),
        seriesId: z.string().max(64).nullable().default(null),
        completedAt: nullableDate,
        archivedAt: nullableDate,
        createdAt: dateStr,
        updatedAt: dateStr,
        projectId: z.string().max(64).nullable().default(null),
        noteId: z.string().max(64).nullable().default(null),
        tagIds: z.array(z.string().max(64)).default([]),
        subtasks: z
          .array(
            z.object({
              id: z.string().min(1).max(64),
              title: z.string().min(1).max(500),
              done: z.boolean(),
              sortOrder: z.number().default(0),
              createdAt: dateStr,
            }),
          )
          .default([]),
      }),
    ),
    noteLinks: z.array(z.object({ fromId: z.string().max(64), toId: z.string().max(64), createdAt: dateStr })).default([]),
    reminders: z.array(
      z.object({
        id: z.string().min(1).max(64),
        title: z.string().min(1).max(500),
        description: z.string().max(50_000).default(""),
        remindAt: dateStr,
        status: z.enum(["pending", "done", "dismissed"]),
        recurrence: z.string().max(200).nullable().default(null),
        notifiedAt: nullableDate,
        snoozeCount: z.number().int().min(0).default(0),
        completedAt: nullableDate,
        dismissedAt: nullableDate,
        createdAt: dateStr,
        updatedAt: dateStr,
        taskId: z.string().max(64).nullable().default(null),
        noteId: z.string().max(64).nullable().default(null),
        projectId: z.string().max(64).nullable().default(null),
      }),
    ),
    inboxItems: z
      .array(z.object({ id: z.string().min(1).max(64), content: z.string().min(1).max(10_000), createdAt: dateStr, updatedAt: dateStr }))
      .default([]),
  }),
});

export type Backup = z.infer<typeof backupSchema>;

export type ImportMode = "merge" | "replace";

export interface ImportSummary {
  mode: ImportMode;
  dryRun: boolean;
  counts: Record<"projects" | "tags" | "notes" | "tasks" | "reminders" | "inboxItems", { incoming: number; added: number; skipped: number }>;
  preImportBackup?: string;
}
