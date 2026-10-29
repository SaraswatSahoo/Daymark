"use server";

import { z } from "zod";
import { run } from "../action-result";
import { refreshAll } from "./context";
import * as projects from "../services/projects";
import * as tags from "../services/tags";
import * as inbox from "../services/inbox";
import { id, isoDate, projectCreateSchema, projectUpdateSchema, tagName, tagUpdateSchema } from "@/lib/validation";

/* Projects */

export async function createProjectAction(input: z.input<typeof projectCreateSchema>) {
  return run(async () => {
    const p = await projects.createProject(input);
    refreshAll();
    return { id: p.id, name: p.name, color: p.color, icon: p.icon };
  });
}

export async function updateProjectAction(input: z.input<typeof projectUpdateSchema>) {
  return run(async () => {
    await projects.updateProject(input);
    refreshAll();
  });
}

export async function archiveProjectAction(projectId: string, archived: boolean) {
  return run(async () => {
    await projects.archiveProject(id.parse(projectId), archived);
    refreshAll();
  });
}

export async function deleteProjectAction(projectId: string, deleteContents: boolean) {
  return run(async () => {
    await projects.deleteProject(id.parse(projectId), z.boolean().parse(deleteContents));
    refreshAll();
  });
}

export async function reorderProjectsAction(ids: string[]) {
  return run(async () => {
    await projects.reorderProjects(z.array(id).max(500).parse(ids));
    refreshAll();
  });
}

/* Tags */

export async function updateTagAction(input: z.input<typeof tagUpdateSchema>) {
  return run(async () => {
    await tags.updateTag(input);
    refreshAll();
  });
}

export async function deleteTagAction(tagId: string) {
  return run(async () => {
    await tags.deleteTag(id.parse(tagId));
    refreshAll();
  });
}

export async function listTagsAction() {
  return run(() => tags.listTags());
}

/* Inbox */

export async function createInboxItemAction(content: string) {
  return run(async () => {
    const item = await inbox.createInboxItem({ content });
    refreshAll();
    return item;
  });
}

export async function updateInboxItemAction(itemId: string, content: string) {
  return run(async () => {
    await inbox.updateInboxItem(id.parse(itemId), content);
    refreshAll();
  });
}

export async function deleteInboxItemAction(itemId: string) {
  return run(async () => {
    await inbox.deleteInboxItem(id.parse(itemId));
    refreshAll();
  });
}

export async function convertInboxItemAction(
  itemId: string,
  to: "task" | "note",
  options: { projectId?: string | null; tags?: string[]; dueDate?: string | null } = {},
) {
  return run(async () => {
    const parsed = z
      .object({
        to: z.enum(["task", "note"]),
        projectId: id.nullish(),
        tags: z.array(tagName).max(20).optional(),
        dueDate: isoDate.nullish(),
      })
      .parse({ to, ...options });
    const result = await inbox.convertInboxItem(id.parse(itemId), parsed.to, parsed);
    refreshAll();
    return result;
  });
}

export async function markOrganizedAction(kind: "task" | "note", itemId: string) {
  return run(async () => {
    await inbox.clearInboxFlag(z.enum(["task", "note"]).parse(kind), id.parse(itemId));
    refreshAll();
  });
}

export async function switchInboxKindAction(kind: "task" | "note", itemId: string) {
  return run(async () => {
    const r = await inbox.switchInboxKind(z.enum(["task", "note"]).parse(kind), id.parse(itemId));
    refreshAll();
    return r;
  });
}
