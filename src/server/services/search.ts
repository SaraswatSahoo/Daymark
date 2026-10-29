import "server-only";
import { db } from "../db";
import { excerpt } from "../mappers";
import type { SearchResults } from "@/lib/types";

/** Returns a short window of text around the first match of `q`. */
export function snippetAround(text: string, q: string, radius = 60): string {
  const plain = excerpt(text, 100_000);
  const idx = plain.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return plain.slice(0, radius * 2) + (plain.length > radius * 2 ? "…" : "");
  const start = Math.max(0, idx - radius);
  const end = Math.min(plain.length, idx + q.length + radius);
  return `${start > 0 ? "…" : ""}${plain.slice(start, end)}${end < plain.length ? "…" : ""}`;
}

function rank<T extends { title: string }>(items: T[], q: string): T[] {
  const lq = q.toLowerCase();
  const score = (t: string) => {
    const lt = t.toLowerCase();
    if (lt === lq) return 0;
    if (lt.startsWith(lq)) return 1;
    if (lt.includes(lq)) return 2;
    return 3;
  };
  return [...items].sort((a, b) => score(a.title) - score(b.title));
}

/**
 * Global search across notes, tasks, projects and reminders. Matching is
 * case-insensitive (Postgres ILIKE) and fast enough for a personal dataset; titles
 * rank above body matches.
 */
export async function searchAll(rawQuery: string, limit = 8): Promise<SearchResults> {
  const q = rawQuery.trim().slice(0, 200);
  if (!q) return { query: q, tasks: [], notes: [], projects: [], reminders: [] };

  const [tasks, notes, projects, reminders] = await Promise.all([
    db.task.findMany({
      where: { archivedAt: null, OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] },
      select: { id: true, title: true, description: true, status: true, dueDate: true },
      orderBy: { updatedAt: "desc" },
      take: limit * 3,
    }),
    db.note.findMany({
      where: { archivedAt: null, OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] },
      select: { id: true, title: true, content: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: limit * 3,
    }),
    db.project.findMany({
      where: { archivedAt: null, OR: [{ name: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] },
      select: { id: true, name: true, color: true },
      take: limit,
    }),
    db.reminder.findMany({
      where: { status: "pending", OR: [{ title: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] },
      select: { id: true, title: true, remindAt: true, status: true },
      orderBy: { remindAt: "asc" },
      take: limit,
    }),
  ]);

  return {
    query: q,
    tasks: rank(tasks, q)
      .slice(0, limit)
      .map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: t.dueDate,
        snippet: t.title.toLowerCase().includes(q.toLowerCase()) ? "" : snippetAround(t.description, q),
      })),
    notes: rank(notes.map((n) => ({ ...n, title: n.title || "Untitled" })), q)
      .slice(0, limit)
      .map((n) => ({
        id: n.id,
        title: n.title,
        updatedAt: n.updatedAt.toISOString(),
        snippet: snippetAround(n.content, q),
      })),
    projects: projects.map((p) => ({ id: p.id, name: p.name, color: p.color })),
    reminders: reminders.map((r) => ({ id: r.id, title: r.title, remindAt: r.remindAt.toISOString(), status: r.status })),
  };
}
