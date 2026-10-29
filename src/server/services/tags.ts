import "server-only";
import { db } from "../db";
import { tagUpdateSchema } from "@/lib/validation";
import { UserError } from "../action-result";
import type { z } from "zod";

export function normalizeTagNames(names: string[] | undefined): string[] {
  if (!names) return [];
  return [...new Set(names.map((n) => n.trim().replace(/^#/, "").toLowerCase()).filter(Boolean))].slice(0, 20);
}

/** Prisma relation payload that connects existing tags by name and creates missing ones. */
export function tagsConnect(names: string[]) {
  return normalizeTagNames(names).map((name) => ({ where: { name }, create: { name } }));
}

export async function listTags() {
  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true, notes: true } } },
  });
  return tags.map((t) => ({ id: t.id, name: t.name, color: t.color, taskCount: t._count.tasks, noteCount: t._count.notes }));
}

export async function updateTag(input: z.input<typeof tagUpdateSchema>) {
  const data = tagUpdateSchema.parse(input);
  if (data.name) {
    const clash = await db.tag.findFirst({ where: { name: data.name, NOT: { id: data.id } } });
    if (clash) throw new UserError(`A tag named #${data.name} already exists.`);
  }
  return db.tag.update({ where: { id: data.id }, data: { name: data.name, color: data.color } });
}

export async function deleteTag(id: string) {
  await db.tag.delete({ where: { id } });
}
