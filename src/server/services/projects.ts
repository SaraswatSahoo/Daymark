import "server-only";
import { db } from "../db";
import { UserError } from "../action-result";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/validation";
import type { ProjectDTO, ProjectRef } from "@/lib/types";
import type { z } from "zod";

export async function listProjects(options: { archived?: boolean } = {}): Promise<ProjectDTO[]> {
  const projects = await db.project.findMany({
    where: { archivedAt: options.archived ? { not: null } : null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { notes: { where: { archivedAt: null } } } } },
  });
  const counts = await db.task.groupBy({
    by: ["projectId", "status"],
    where: { projectId: { in: projects.map((p) => p.id) }, archivedAt: null },
    _count: { _all: true },
  });
  return projects.map((p) => {
    const mine = counts.filter((c) => c.projectId === p.id);
    const doneTasks = mine.filter((c) => c.status === "done").reduce((n, c) => n + c._count._all, 0);
    const openTasks = mine.filter((c) => c.status !== "done").reduce((n, c) => n + c._count._all, 0);
    return {
      id: p.id,
      name: p.name,
      color: p.color,
      icon: p.icon,
      description: p.description,
      archivedAt: p.archivedAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      openTasks,
      doneTasks,
      noteCount: p._count.notes,
    };
  });
}

export async function listProjectRefs(): Promise<ProjectRef[]> {
  return db.project.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, color: true, icon: true },
  });
}

export async function getProject(id: string): Promise<ProjectDTO | null> {
  const all = await db.project.findUnique({ where: { id }, select: { archivedAt: true } });
  if (!all) return null;
  const list = await listProjects({ archived: !!all.archivedAt });
  return list.find((p) => p.id === id) ?? null;
}

export async function createProject(input: z.input<typeof projectCreateSchema>) {
  const data = projectCreateSchema.parse(input);
  const last = await db.project.findFirst({ orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
  return db.project.create({
    data: {
      name: data.name,
      description: data.description ?? "",
      color: data.color ?? "indigo",
      icon: data.icon ?? null,
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });
}

export async function updateProject(input: z.input<typeof projectUpdateSchema>) {
  const { id, ...data } = projectUpdateSchema.parse(input);
  return db.project.update({ where: { id }, data });
}

export async function archiveProject(id: string, archived: boolean) {
  await db.project.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
}

/**
 * Deletes a project. Its tasks and notes are kept and become unassigned
 * unless `deleteContents` is set.
 */
export async function deleteProject(id: string, deleteContents = false) {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) throw new UserError("That project no longer exists.");
  await db.$transaction(async (tx) => {
    if (deleteContents) {
      await tx.task.deleteMany({ where: { projectId: id } });
      await tx.note.deleteMany({ where: { projectId: id } });
    }
    await tx.project.delete({ where: { id } });
  });
}

export async function reorderProjects(ids: string[]) {
  await db.$transaction(ids.map((id, i) => db.project.update({ where: { id }, data: { sortOrder: i } })));
}
