import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { zipSync, strToU8 } from "fflate";
import { db } from "../db";
import { UserError } from "../action-result";
import { BACKUP_VERSION, backupSchema, type Backup, type ImportMode, type ImportSummary } from "@/lib/backup-schema";

const d = (x: Date | null | undefined) => (x ? x.toISOString() : null);

export async function exportAll(): Promise<Backup> {
  const [settings, projects, tags, notes, tasks, noteLinks, reminders, inboxItems] = await Promise.all([
    db.settings.findUnique({ where: { id: 1 } }),
    db.project.findMany({ orderBy: { createdAt: "asc" } }),
    db.tag.findMany({ orderBy: { createdAt: "asc" } }),
    db.note.findMany({ include: { tags: { select: { id: true } } }, orderBy: { createdAt: "asc" } }),
    db.task.findMany({ include: { tags: { select: { id: true } }, subtasks: true }, orderBy: { createdAt: "asc" } }),
    db.noteLink.findMany(),
    db.reminder.findMany({ orderBy: { createdAt: "asc" } }),
    db.inboxItem.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  return {
    app: "daymark",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      settings: settings
        ? {
            displayName: settings.displayName,
            theme: settings.theme,
            accent: settings.accent,
            timezone: settings.timezone,
            weekStart: settings.weekStart,
            dateFormat: settings.dateFormat,
            timeFormat: settings.timeFormat,
            defaultPriority: settings.defaultPriority,
            defaultReminderTime: settings.defaultReminderTime,
            defaultSnoozeMinutes: settings.defaultSnoozeMinutes,
            dashboardLayout: settings.dashboardLayout,
          }
        : null,
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        color: p.color,
        icon: p.icon,
        sortOrder: p.sortOrder,
        archivedAt: d(p.archivedAt),
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
      tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, createdAt: t.createdAt.toISOString() })),
      notes: notes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content,
        pinned: n.pinned,
        inbox: n.inbox,
        journalDate: n.journalDate,
        archivedAt: d(n.archivedAt),
        createdAt: n.createdAt.toISOString(),
        updatedAt: n.updatedAt.toISOString(),
        projectId: n.projectId,
        tagIds: n.tags.map((t) => t.id),
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status as "todo" | "in_progress" | "done",
        priority: t.priority,
        dueDate: t.dueDate,
        dueTime: t.dueTime,
        myDayDate: t.myDayDate,
        inbox: t.inbox,
        sortOrder: t.sortOrder,
        recurrence: t.recurrence,
        seriesId: t.seriesId,
        completedAt: d(t.completedAt),
        archivedAt: d(t.archivedAt),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        projectId: t.projectId,
        noteId: t.noteId,
        tagIds: t.tags.map((x) => x.id),
        subtasks: t.subtasks.map((s) => ({
          id: s.id,
          title: s.title,
          done: s.done,
          sortOrder: s.sortOrder,
          createdAt: s.createdAt.toISOString(),
        })),
      })),
      noteLinks: noteLinks.map((l) => ({ fromId: l.fromId, toId: l.toId, createdAt: l.createdAt.toISOString() })),
      reminders: reminders.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        remindAt: r.remindAt.toISOString(),
        status: r.status as "pending" | "done" | "dismissed",
        recurrence: r.recurrence,
        notifiedAt: d(r.notifiedAt),
        snoozeCount: r.snoozeCount,
        completedAt: d(r.completedAt),
        dismissedAt: d(r.dismissedAt),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        taskId: r.taskId,
        noteId: r.noteId,
        projectId: r.projectId,
      })),
      inboxItems: inboxItems.map((i) => ({
        id: i.id,
        content: i.content,
        createdAt: i.createdAt.toISOString(),
        updatedAt: i.updatedAt.toISOString(),
      })),
    },
  };
}

export function parseBackup(raw: unknown): Backup {
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new UserError(
      `This file is not a valid ${"Daymark"} backup${issue ? ` (${issue.path.join(".")}: ${issue.message})` : ""}.`,
    );
  }
  return result.data;
}

const safeName = (s: string) =>
  (s || "untitled")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80) || "untitled";

/** All notes as Markdown files with YAML front matter, zipped. */
export async function exportNotesZip(): Promise<Uint8Array> {
  const notes = await db.note.findMany({
    include: { tags: { select: { name: true } }, project: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  const files: Record<string, Uint8Array> = {};
  const used = new Set<string>();
  for (const n of notes) {
    const folder = n.archivedAt ? "archive/" : n.journalDate ? "journal/" : n.project ? `${safeName(n.project.name)}/` : "";
    let base = `${folder}${safeName(n.journalDate ?? n.title)}`;
    let i = 2;
    while (used.has(base)) base = `${folder}${safeName(n.journalDate ?? n.title)} (${i++})`;
    used.add(base);
    const fm = [
      "---",
      `title: ${JSON.stringify(n.title)}`,
      `created: ${n.createdAt.toISOString()}`,
      `updated: ${n.updatedAt.toISOString()}`,
      n.project ? `project: ${JSON.stringify(n.project.name)}` : null,
      n.tags.length ? `tags: [${n.tags.map((t) => JSON.stringify(t.name)).join(", ")}]` : null,
      n.journalDate ? `journal: ${n.journalDate}` : null,
      "---",
      "",
    ]
      .filter((l) => l !== null)
      .join("\n");
    const heading = n.title && !n.content.trimStart().startsWith("# ") ? `# ${n.title}\n\n` : "";
    files[`${base}.md`] = strToU8(`${fm}${heading}${n.content}\n`);
  }
  if (!notes.length) files["README.md"] = strToU8("No notes yet.\n");
  return zipSync(files, { level: 6 });
}

async function writePreImportBackup(): Promise<string> {
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `pre-import-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify(await exportAll()), "utf8");
  return path.relative(process.cwd(), file);
}

/**
 * Imports a backup.
 * - merge: adds records whose ids are not already present; existing records are never modified.
 * - replace: saves a pre-import backup to ./backups, then replaces all data with the backup.
 * With `dryRun`, nothing is written and the summary describes what would happen.
 */
export async function importBackup(raw: unknown, mode: ImportMode, dryRun: boolean): Promise<ImportSummary> {
  const backup = parseBackup(raw);
  const data = backup.data;

  const existingIds = async () => {
    if (mode === "replace") {
      return { projects: new Set<string>(), tags: new Map<string, string>(), notes: new Set<string>(), tasks: new Set<string>(), reminders: new Set<string>(), inbox: new Set<string>(), journalDates: new Set<string>(), subtasks: new Set<string>() };
    }
    const [p, t, n, k, r, i, s] = await Promise.all([
      db.project.findMany({ select: { id: true } }),
      db.tag.findMany({ select: { id: true, name: true } }),
      db.note.findMany({ select: { id: true, journalDate: true } }),
      db.task.findMany({ select: { id: true } }),
      db.reminder.findMany({ select: { id: true } }),
      db.inboxItem.findMany({ select: { id: true } }),
      db.subtask.findMany({ select: { id: true } }),
    ]);
    return {
      projects: new Set(p.map((x) => x.id)),
      tags: new Map(t.map((x) => [x.name, x.id])),
      notes: new Set(n.map((x) => x.id)),
      journalDates: new Set(n.map((x) => x.journalDate).filter((x): x is string => !!x)),
      tasks: new Set(k.map((x) => x.id)),
      reminders: new Set(r.map((x) => x.id)),
      inbox: new Set(i.map((x) => x.id)),
      subtasks: new Set(s.map((x) => x.id)),
    };
  };

  const ex = await existingIds();
  const existingTagIds = new Set(ex.tags.values());

  // Tags are matched by name; imported tag ids are remapped to existing ones.
  const tagIdMap = new Map<string, string>();
  const newTags = [] as typeof data.tags;
  for (const t of data.tags) {
    const name = t.name.trim().toLowerCase();
    const existing = ex.tags.get(name);
    if (existing) tagIdMap.set(t.id, existing);
    else if (existingTagIds.has(t.id)) continue;
    else {
      tagIdMap.set(t.id, t.id);
      newTags.push({ ...t, name });
      ex.tags.set(name, t.id);
    }
  }

  const newProjects = data.projects.filter((p) => !ex.projects.has(p.id));
  const newNotes = data.notes.filter((n) => !ex.notes.has(n.id) && !(n.journalDate && ex.journalDates.has(n.journalDate)));
  const newTasks = data.tasks.filter((t) => !ex.tasks.has(t.id));
  const newReminders = data.reminders.filter((r) => !ex.reminders.has(r.id));
  const newInbox = data.inboxItems.filter((i) => !ex.inbox.has(i.id));

  const summary: ImportSummary = {
    mode,
    dryRun,
    counts: {
      projects: { incoming: data.projects.length, added: newProjects.length, skipped: data.projects.length - newProjects.length },
      tags: { incoming: data.tags.length, added: newTags.length, skipped: data.tags.length - newTags.length },
      notes: { incoming: data.notes.length, added: newNotes.length, skipped: data.notes.length - newNotes.length },
      tasks: { incoming: data.tasks.length, added: newTasks.length, skipped: data.tasks.length - newTasks.length },
      reminders: { incoming: data.reminders.length, added: newReminders.length, skipped: data.reminders.length - newReminders.length },
      inboxItems: { incoming: data.inboxItems.length, added: newInbox.length, skipped: data.inboxItems.length - newInbox.length },
    },
  };
  if (dryRun) return summary;

  if (mode === "replace") summary.preImportBackup = await writePreImportBackup();

  const projectIds = new Set([...(mode === "merge" ? ex.projects : []), ...data.projects.map((p) => p.id)]);
  const noteIds = new Set([...(mode === "merge" ? ex.notes : []), ...newNotes.map((n) => n.id)]);
  const taskIds = new Set([...(mode === "merge" ? ex.tasks : []), ...newTasks.map((t) => t.id)]);
  const ref = (id: string | null, set: Set<string>) => (id && set.has(id) ? id : null);
  const tagRefs = (ids: string[]) =>
    [...new Set(ids.map((id) => tagIdMap.get(id)).filter((x): x is string => !!x))].map((id) => ({ id }));
  const date = (s: string | null | undefined) => (s ? new Date(s) : null);

  await db.$transaction(
    async (tx) => {
      if (mode === "replace") {
        await tx.reminder.deleteMany();
        await tx.subtask.deleteMany();
        await tx.task.deleteMany();
        await tx.noteLink.deleteMany();
        await tx.note.deleteMany();
        await tx.tag.deleteMany();
        await tx.project.deleteMany();
        await tx.inboxItem.deleteMany();
        if (data.settings) {
          await tx.settings.upsert({ where: { id: 1 }, update: data.settings, create: { id: 1, ...data.settings } });
        }
      }
      for (const p of newProjects) {
        await tx.project.create({
          data: { ...p, archivedAt: date(p.archivedAt), createdAt: new Date(p.createdAt), updatedAt: new Date(p.updatedAt) },
        });
      }
      for (const t of newTags) {
        await tx.tag.create({ data: { id: t.id, name: t.name, color: t.color, createdAt: new Date(t.createdAt) } });
      }
      for (const n of newNotes) {
        await tx.note.create({
          data: {
            id: n.id,
            title: n.title,
            content: n.content,
            pinned: n.pinned,
            inbox: n.inbox,
            journalDate: n.journalDate,
            archivedAt: date(n.archivedAt),
            createdAt: new Date(n.createdAt),
            updatedAt: new Date(n.updatedAt),
            projectId: ref(n.projectId, projectIds),
            tags: { connect: tagRefs(n.tagIds) },
          },
        });
      }
      for (const t of newTasks) {
        await tx.task.create({
          data: {
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            myDayDate: t.myDayDate,
            inbox: t.inbox,
            sortOrder: t.sortOrder,
            recurrence: t.recurrence,
            seriesId: t.seriesId,
            completedAt: date(t.completedAt),
            archivedAt: date(t.archivedAt),
            createdAt: new Date(t.createdAt),
            updatedAt: new Date(t.updatedAt),
            projectId: ref(t.projectId, projectIds),
            noteId: ref(t.noteId, noteIds),
            tags: { connect: tagRefs(t.tagIds) },
            subtasks: {
              create: t.subtasks
                .filter((s) => !ex.subtasks.has(s.id))
                .map((s) => ({ id: s.id, title: s.title, done: s.done, sortOrder: s.sortOrder, createdAt: new Date(s.createdAt) })),
            },
          },
        });
      }
      for (const l of data.noteLinks) {
        if (noteIds.has(l.fromId) && noteIds.has(l.toId) && l.fromId !== l.toId) {
          await tx.noteLink.upsert({
            where: { fromId_toId: { fromId: l.fromId, toId: l.toId } },
            update: {},
            create: { fromId: l.fromId, toId: l.toId, createdAt: new Date(l.createdAt) },
          });
        }
      }
      for (const r of newReminders) {
        await tx.reminder.create({
          data: {
            id: r.id,
            title: r.title,
            description: r.description,
            remindAt: new Date(r.remindAt),
            status: r.status,
            recurrence: r.recurrence,
            notifiedAt: date(r.notifiedAt),
            snoozeCount: r.snoozeCount,
            completedAt: date(r.completedAt),
            dismissedAt: date(r.dismissedAt),
            createdAt: new Date(r.createdAt),
            updatedAt: new Date(r.updatedAt),
            taskId: ref(r.taskId, taskIds),
            noteId: ref(r.noteId, noteIds),
            projectId: ref(r.projectId, projectIds),
          },
        });
      }
      for (const i of newInbox) {
        await tx.inboxItem.create({
          data: { id: i.id, content: i.content, createdAt: new Date(i.createdAt), updatedAt: new Date(i.updatedAt) },
        });
      }
    },
    { timeout: 120_000, maxWait: 10_000 },
  );

  return summary;
}
