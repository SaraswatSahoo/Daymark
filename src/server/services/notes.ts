import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { UserError } from "../action-result";
import { noteSummaryInclude, taskInclude, toNoteSummary, toTaskDTO } from "../mappers";
import { tagsConnect } from "./tags";
import { noteCreateSchema, noteSaveSchema, noteUpdateSchema, type NoteUpdateInput } from "@/lib/validation";
import type { NoteDetailDTO, NoteSummaryDTO } from "@/lib/types";
import type { z } from "zod";

export interface NoteFilter {
  q?: string;
  projectId?: string;
  tag?: string;
  archived?: boolean;
  journal?: boolean | "only";
  sort?: "updated" | "created" | "title";
}

export async function listNotes(filter: NoteFilter = {}, take = 500): Promise<NoteSummaryDTO[]> {
  const and: Prisma.NoteWhereInput[] = [{ archivedAt: filter.archived ? { not: null } : null }];
  if (filter.projectId === "none") and.push({ projectId: null });
  else if (filter.projectId) and.push({ projectId: filter.projectId });
  if (filter.tag) and.push({ tags: { some: { name: filter.tag.toLowerCase() } } });
  if (filter.journal === "only") and.push({ journalDate: { not: null } });
  else if (filter.journal === false) and.push({ journalDate: null });
  const q = filter.q?.trim().slice(0, 200);
  if (q) and.push({ OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] });

  const orderBy: Prisma.NoteOrderByWithRelationInput[] =
    filter.sort === "title"
      ? [{ title: "asc" }]
      : filter.sort === "created"
        ? [{ createdAt: "desc" }]
        : filter.journal === "only"
          ? [{ journalDate: "desc" }]
          : [{ updatedAt: "desc" }];

  const rows = await db.note.findMany({ where: { AND: and }, include: noteSummaryInclude, orderBy, take });
  return rows.map(toNoteSummary);
}

export async function getNote(id: string): Promise<NoteDetailDTO | null> {
  const note = await db.note.findUnique({
    where: { id },
    include: {
      ...noteSummaryInclude,
      tasks: { where: { archivedAt: null }, include: taskInclude, orderBy: { createdAt: "asc" } },
      linksFrom: { include: { to: { select: { id: true, title: true } } } },
      linksTo: { include: { from: { select: { id: true, title: true } } } },
    },
  });
  if (!note) return null;

  const relatedMap = new Map<string, { id: string; title: string }>();
  for (const l of note.linksFrom) relatedMap.set(l.to.id, l.to);
  for (const l of note.linksTo) relatedMap.set(l.from.id, l.from);

  // Backlinks: other notes that reference this one with [[Title]].
  const backlinks = note.title.trim()
    ? await db.note.findMany({
        where: { id: { not: id }, archivedAt: null, content: { contains: `[[${note.title.trim()}]]`, mode: "insensitive" } },
        select: { id: true, title: true },
        take: 50,
      })
    : [];

  return {
    ...toNoteSummary(note),
    content: note.content,
    tasks: note.tasks.map(toTaskDTO),
    related: [...relatedMap.values()],
    backlinks,
  };
}

export async function createNote(input: z.input<typeof noteCreateSchema>) {
  const data = noteCreateSchema.parse(input);
  const note = await db.note.create({
    data: {
      title: data.title.trim(),
      content: data.content,
      inbox: data.inbox ?? false,
      pinned: data.pinned ?? false,
      projectId: data.projectId ?? null,
      tags: data.tags?.length ? { connectOrCreate: tagsConnect(data.tags) } : undefined,
    },
    include: noteSummaryInclude,
  });
  return toNoteSummary(note);
}

export async function updateNote(input: NoteUpdateInput) {
  const data = noteUpdateSchema.parse(input);
  const update: Prisma.NoteUpdateInput = {};
  if (data.title !== undefined) update.title = data.title;
  if (data.content !== undefined) update.content = data.content;
  if (data.pinned !== undefined) update.pinned = data.pinned;
  if (data.inbox !== undefined) update.inbox = data.inbox;
  if (data.projectId !== undefined) {
    update.project = data.projectId ? { connect: { id: data.projectId } } : { disconnect: true };
    if (data.projectId && data.inbox === undefined) update.inbox = false;
  }
  if (data.tags !== undefined) update.tags = { set: [], connectOrCreate: tagsConnect(data.tags) };
  const note = await db.note.update({ where: { id: data.id }, data: update, include: noteSummaryInclude });
  return toNoteSummary(note);
}

export type SaveNoteResult =
  | { status: "saved"; updatedAt: string }
  | { status: "conflict"; updatedAt: string; title: string; content: string };

/**
 * Autosave. If the note changed on the server since the editor loaded it (another tab
 * or device), the save is rejected with the server copy so the user can choose.
 */
export async function saveNoteContent(id: string, body: z.input<typeof noteSaveSchema>): Promise<SaveNoteResult> {
  const data = noteSaveSchema.parse(body);
  const existing = await db.note.findUnique({ where: { id }, select: { updatedAt: true, title: true, content: true } });
  if (!existing) throw new UserError("This note no longer exists.");
  if (
    !data.force &&
    data.baseUpdatedAt &&
    existing.updatedAt.getTime() > new Date(data.baseUpdatedAt).getTime() &&
    (existing.title !== data.title || existing.content !== data.content)
  ) {
    return {
      status: "conflict",
      updatedAt: existing.updatedAt.toISOString(),
      title: existing.title,
      content: existing.content,
    };
  }
  if (existing.title === data.title && existing.content === data.content) {
    return { status: "saved", updatedAt: existing.updatedAt.toISOString() };
  }
  const note = await db.note.update({
    where: { id },
    data: { title: data.title, content: data.content },
    select: { updatedAt: true },
  });
  return { status: "saved", updatedAt: note.updatedAt.toISOString() };
}

export async function archiveNote(id: string, archived: boolean) {
  await db.note.update({ where: { id }, data: { archivedAt: archived ? new Date() : null, pinned: archived ? false : undefined } });
}

export async function deleteNote(id: string) {
  await db.note.delete({ where: { id } });
}

export async function duplicateNote(id: string) {
  const n = await db.note.findUnique({ where: { id }, include: { tags: true } });
  if (!n) throw new UserError("That note no longer exists.");
  const copy = await db.note.create({
    data: {
      title: n.title ? `${n.title} (copy)` : "",
      content: n.content,
      projectId: n.projectId,
      tags: { connect: n.tags.map((t) => ({ id: t.id })) },
    },
  });
  return copy.id;
}

export async function linkNotes(fromId: string, toId: string) {
  if (fromId === toId) throw new UserError("A note cannot be linked to itself.");
  const reverse = await db.noteLink.findUnique({ where: { fromId_toId: { fromId: toId, toId: fromId } } });
  if (reverse) return;
  await db.noteLink.upsert({
    where: { fromId_toId: { fromId, toId } },
    update: {},
    create: { fromId, toId },
  });
}

export async function unlinkNotes(a: string, b: string) {
  await db.noteLink.deleteMany({
    where: { OR: [{ fromId: a, toId: b }, { fromId: b, toId: a }] },
  });
}

export async function listNoteOptions(query: string, excludeId?: string, limit = 20) {
  return db.note.findMany({
    where: {
      archivedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(query ? { title: { contains: query, mode: "insensitive" } } : {}),
    },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/** Opens (or creates) the journal entry for a calendar day. */
export async function getOrCreateJournal(date: string, template: (date: string) => { title: string; content: string }) {
  const existing = await db.note.findUnique({ where: { journalDate: date }, select: { id: true } });
  if (existing) return existing.id;
  const { title, content } = template(date);
  try {
    const note = await db.note.create({ data: { title, content, journalDate: date } });
    return note.id;
  } catch {
    // Created concurrently by another request.
    const again = await db.note.findUnique({ where: { journalDate: date }, select: { id: true } });
    if (again) return again.id;
    throw new UserError("Could not open the journal entry.");
  }
}
