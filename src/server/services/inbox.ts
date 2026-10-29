import "server-only";
import { db } from "../db";
import { UserError } from "../action-result";
import { noteSummaryInclude, taskInclude, toNoteSummary, toTaskDTO } from "../mappers";
import { inboxCreateSchema } from "@/lib/validation";
import type { InboxItemDTO, NoteSummaryDTO, TaskDTO } from "@/lib/types";

export interface InboxContents {
  ideas: InboxItemDTO[];
  tasks: TaskDTO[];
  notes: NoteSummaryDTO[];
  count: number;
}

export async function getInbox(): Promise<InboxContents> {
  const [ideas, tasks, notes] = await Promise.all([
    db.inboxItem.findMany({ orderBy: { createdAt: "desc" } }),
    db.task.findMany({
      where: { inbox: true, archivedAt: null, status: { not: "done" } },
      include: taskInclude,
      orderBy: { createdAt: "desc" },
    }),
    db.note.findMany({
      where: { inbox: true, archivedAt: null },
      include: noteSummaryInclude,
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return {
    ideas: ideas.map((i) => ({ id: i.id, content: i.content, createdAt: i.createdAt.toISOString() })),
    tasks: tasks.map(toTaskDTO),
    notes: notes.map(toNoteSummary),
    count: ideas.length + tasks.length + notes.length,
  };
}

export async function inboxCount(): Promise<number> {
  const [a, b, c] = await Promise.all([
    db.inboxItem.count(),
    db.task.count({ where: { inbox: true, archivedAt: null, status: { not: "done" } } }),
    db.note.count({ where: { inbox: true, archivedAt: null } }),
  ]);
  return a + b + c;
}

export async function createInboxItem(input: { content: string }): Promise<InboxItemDTO> {
  const data = inboxCreateSchema.parse(input);
  const i = await db.inboxItem.create({ data: { content: data.content } });
  return { id: i.id, content: i.content, createdAt: i.createdAt.toISOString() };
}

export async function updateInboxItem(id: string, content: string) {
  const data = inboxCreateSchema.parse({ content });
  await db.inboxItem.update({ where: { id }, data: { content: data.content } });
}

export async function deleteInboxItem(id: string) {
  await db.inboxItem.delete({ where: { id } });
}

function splitIdea(content: string): { title: string; body: string } {
  const [first, ...rest] = content.trim().split("\n");
  const title = first.trim().slice(0, 300);
  const overflow = first.trim().length > 300 ? first.trim().slice(300) : "";
  return { title, body: [overflow, ...rest].join("\n").trim() };
}

/** Converts an inbox idea into a task or note, in one transaction (no data lost on failure). */
export async function convertInboxItem(
  id: string,
  to: "task" | "note",
  options: { projectId?: string | null; tags?: string[]; dueDate?: string | null } = {},
) {
  const item = await db.inboxItem.findUnique({ where: { id } });
  if (!item) throw new UserError("That inbox item no longer exists.");
  const { title, body } = splitIdea(item.content);
  const tags = (options.tags ?? []).map((name) => ({ where: { name }, create: { name } }));
  return db.$transaction(async (tx) => {
    let createdId: string;
    if (to === "task") {
      const task = await tx.task.create({
        data: {
          title: title || "Untitled task",
          description: body,
          projectId: options.projectId ?? null,
          dueDate: options.dueDate ?? null,
          inbox: false,
          tags: tags.length ? { connectOrCreate: tags } : undefined,
        },
      });
      createdId = task.id;
    } else {
      const note = await tx.note.create({
        data: {
          title,
          content: body,
          projectId: options.projectId ?? null,
          tags: tags.length ? { connectOrCreate: tags } : undefined,
        },
      });
      createdId = note.id;
    }
    await tx.inboxItem.delete({ where: { id } });
    return { id: createdId, type: to };
  });
}

export async function clearInboxFlag(kind: "task" | "note", id: string) {
  if (kind === "task") await db.task.update({ where: { id }, data: { inbox: false } });
  else await db.note.update({ where: { id }, data: { inbox: false } });
}

/** Turns an inbox task into a note (or vice versa) preserving its text. */
export async function switchInboxKind(kind: "task" | "note", id: string) {
  return db.$transaction(async (tx) => {
    if (kind === "task") {
      const t = await tx.task.findUnique({ where: { id }, include: { tags: true } });
      if (!t) throw new UserError("That task no longer exists.");
      const note = await tx.note.create({
        data: {
          title: t.title,
          content: t.description,
          projectId: t.projectId,
          inbox: true,
          tags: { connect: t.tags.map((x) => ({ id: x.id })) },
        },
      });
      await tx.task.delete({ where: { id } });
      return { id: note.id, type: "note" as const };
    }
    const n = await tx.note.findUnique({ where: { id }, include: { tags: true } });
    if (!n) throw new UserError("That note no longer exists.");
    const task = await tx.task.create({
      data: {
        title: n.title || n.content.split("\n")[0].slice(0, 300) || "Untitled task",
        description: n.title ? n.content : n.content.split("\n").slice(1).join("\n"),
        projectId: n.projectId,
        inbox: true,
        tags: { connect: n.tags.map((x) => ({ id: x.id })) },
      },
    });
    await tx.note.delete({ where: { id } });
    return { id: task.id, type: "task" as const };
  });
}
