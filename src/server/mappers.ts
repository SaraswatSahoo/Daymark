import "server-only";
import type { Prisma } from "@prisma/client";
import { parseRecurrence } from "@/lib/recurrence";
import type {
  NoteSummaryDTO,
  ProjectRef,
  ReminderDTO,
  SubtaskDTO,
  TagDTO,
  TaskDTO,
  TaskDetailDTO,
} from "@/lib/types";

export const projectRefSelect = { id: true, name: true, color: true, icon: true } satisfies Prisma.ProjectSelect;
export const tagSelect = { id: true, name: true, color: true } satisfies Prisma.TagSelect;

export const taskInclude = {
  project: { select: projectRefSelect },
  note: { select: { id: true, title: true } },
  tags: { select: tagSelect, orderBy: { name: "asc" } },
  subtasks: { select: { done: true } },
  reminders: {
    where: { status: "pending" },
    orderBy: { remindAt: "asc" },
    take: 1,
    select: { remindAt: true },
  },
} satisfies Prisma.TaskInclude;

export type TaskWithRelations = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export const reminderInclude = {
  task: { select: { id: true, title: true } },
  note: { select: { id: true, title: true } },
  project: { select: projectRefSelect },
} satisfies Prisma.ReminderInclude;

export type ReminderWithRelations = Prisma.ReminderGetPayload<{ include: typeof reminderInclude }>;

export const noteSummaryInclude = {
  project: { select: projectRefSelect },
  tags: { select: tagSelect, orderBy: { name: "asc" } },
} satisfies Prisma.NoteInclude;

export type NoteWithSummary = Prisma.NoteGetPayload<{ include: typeof noteSummaryInclude }>;

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export function toProjectRef(p: ProjectRef | null | undefined): ProjectRef | null {
  return p ? { id: p.id, name: p.name, color: p.color, icon: p.icon } : null;
}

export function toTag(t: TagDTO): TagDTO {
  return { id: t.id, name: t.name, color: t.color };
}

export function toTaskDTO(t: TaskWithRelations): TaskDTO {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: (t.status as TaskDTO["status"]) ?? "todo",
    priority: t.priority,
    dueDate: t.dueDate,
    dueTime: t.dueTime,
    myDayDate: t.myDayDate,
    inbox: t.inbox,
    sortOrder: t.sortOrder,
    recurrence: parseRecurrence(t.recurrence),
    completedAt: iso(t.completedAt),
    archivedAt: iso(t.archivedAt),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    project: toProjectRef(t.project),
    note: t.note ? { id: t.note.id, title: t.note.title } : null,
    tags: t.tags.map(toTag),
    subtaskCount: t.subtasks.length,
    subtaskDone: t.subtasks.filter((s) => s.done).length,
    nextReminderAt: iso(t.reminders[0]?.remindAt),
  };
}

export function toReminderDTO(r: ReminderWithRelations): ReminderDTO {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    remindAt: r.remindAt.toISOString(),
    status: r.status as ReminderDTO["status"],
    recurrence: parseRecurrence(r.recurrence),
    notifiedAt: iso(r.notifiedAt),
    snoozeCount: r.snoozeCount,
    completedAt: iso(r.completedAt),
    dismissedAt: iso(r.dismissedAt),
    task: r.task,
    note: r.note,
    project: toProjectRef(r.project),
  };
}

export function toTaskDetailDTO(
  t: TaskWithRelations,
  subtasks: SubtaskDTO[],
  reminders: ReminderWithRelations[],
): TaskDetailDTO {
  return { ...toTaskDTO(t), subtasks, reminders: reminders.map(toReminderDTO) };
}

/** Plain-text excerpt of Markdown content for list views and search. */
export function excerpt(markdown: string, length = 160): string {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]\s+\[[ xX]\]|[-*+]|\d+\.)\s*/gm, "")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > length ? `${text.slice(0, length - 1).trimEnd()}…` : text;
}

export function toNoteSummary(n: NoteWithSummary & { content: string }): NoteSummaryDTO {
  return {
    id: n.id,
    title: n.title,
    excerpt: excerpt(n.content),
    pinned: n.pinned,
    inbox: n.inbox,
    journalDate: n.journalDate,
    archivedAt: iso(n.archivedAt),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    project: toProjectRef(n.project),
    tags: n.tags.map(toTag),
  };
}
