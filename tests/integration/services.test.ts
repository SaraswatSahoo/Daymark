import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import * as tasks from "@/server/services/tasks";
import * as notes from "@/server/services/notes";
import * as reminders from "@/server/services/reminders";
import * as inbox from "@/server/services/inbox";
import * as projects from "@/server/services/projects";
import { searchAll } from "@/server/services/search";
import { exportAll, importBackup } from "@/server/services/backup";
import { getSettings, updateSettings } from "@/server/services/settings";
import { buildIcs } from "@/server/services/ics";

const ctx = { today: "2026-10-29", tz: "UTC", weekStart: 1, defaultPriority: 1 };

async function reset() {
  await db.reminder.deleteMany();
  await db.subtask.deleteMany();
  await db.task.deleteMany();
  await db.noteLink.deleteMany();
  await db.note.deleteMany();
  await db.tag.deleteMany();
  await db.project.deleteMany();
  await db.inboxItem.deleteMany();
  await db.settings.deleteMany();
}

beforeEach(reset);

describe("tasks", () => {
  it("creates, updates, completes and reopens a task", async () => {
    const t = await tasks.createTask({ title: "Write report", tags: ["Work", "#urgent"], subtasks: ["Outline", "Draft"] }, ctx);
    expect(t.tags.map((x) => x.name).sort()).toEqual(["urgent", "work"]);
    expect(t.subtaskCount).toBe(2);

    const u = await tasks.updateTask({ id: t.id, dueDate: "2026-10-30", dueTime: "14:00", priority: 3 }, ctx);
    expect(u).toMatchObject({ dueDate: "2026-10-30", dueTime: "14:00", priority: 3 });

    const { task: done } = await tasks.setTaskStatus(t.id, "done", ctx);
    expect(done.status).toBe("done");
    expect(done.completedAt).not.toBeNull();

    const { task: reopened } = await tasks.setTaskStatus(t.id, "todo", ctx);
    expect(reopened.completedAt).toBeNull();
  });

  it("clearing the due date also clears the time", async () => {
    const t = await tasks.createTask({ title: "x", dueDate: "2026-10-30", dueTime: "09:00" }, ctx);
    const u = await tasks.updateTask({ id: t.id, dueDate: null }, ctx);
    expect(u.dueTime).toBeNull();
  });

  it("completing a recurring task keeps history and creates exactly one next occurrence", async () => {
    const t = await tasks.createTask(
      { title: "Water plants", dueDate: "2026-10-29", recurrence: { freq: "weekly", interval: 1 }, subtasks: ["Balcony"] },
      ctx,
    );
    await tasks.addSubtask({ taskId: t.id, title: "Kitchen" });
    const sub = await db.subtask.findFirst({ where: { taskId: t.id, title: "Balcony" } });
    await tasks.updateSubtask(sub!.id, { done: true });

    const { next } = await tasks.setTaskStatus(t.id, "done", ctx);
    expect(next?.dueDate).toBe("2026-11-05");
    expect(next?.subtaskCount).toBe(2);
    expect(next?.subtaskDone).toBe(0);

    // Toggling the same instance again must not create a duplicate.
    await tasks.setTaskStatus(t.id, "todo", ctx);
    const again = await tasks.setTaskStatus(t.id, "done", ctx);
    expect(again.next).toBeNull();
    const series = await db.task.findMany({ where: { title: "Water plants" } });
    expect(series).toHaveLength(2);
    expect(series.filter((s) => s.status === "done")).toHaveLength(1);
  });

  it("filters by status, date, priority, project and tag", async () => {
    const p = await projects.createProject({ name: "Thesis" });
    await tasks.createTask({ title: "Overdue thing", dueDate: "2026-10-20" }, ctx);
    await tasks.createTask({ title: "Today thing", dueDate: "2026-10-29", priority: 3 }, ctx);
    await tasks.createTask({ title: "Project thing", projectId: p.id, tags: ["research"] }, ctx);
    const done = await tasks.createTask({ title: "Done thing" }, ctx);
    await tasks.setTaskStatus(done.id, "done", ctx);

    const titles = async (f: Parameters<typeof tasks.listTasks>[0]) => (await tasks.listTasks(f, ctx)).map((t) => t.title);
    expect(await titles({})).toHaveLength(3);
    expect(await titles({ due: "overdue" })).toEqual(["Overdue thing"]);
    expect(await titles({ due: "today" })).toEqual(["Today thing"]);
    expect(await titles({ priority: 3 })).toEqual(["Today thing"]);
    expect(await titles({ projectId: p.id })).toEqual(["Project thing"]);
    expect(await titles({ tag: "research" })).toEqual(["Project thing"]);
    expect(await titles({ status: "done" })).toEqual(["Done thing"]);
    expect(await titles({ q: "today" })).toEqual(["Today thing"]);
  });

  it("My Day includes planned and due-today tasks, and lists overdue separately", async () => {
    await tasks.createTask({ title: "Planned", myDay: true }, ctx);
    await tasks.createTask({ title: "Due", dueDate: "2026-10-29" }, ctx);
    await tasks.createTask({ title: "Late", dueDate: "2026-10-01" }, ctx);
    await tasks.createTask({ title: "Later", dueDate: "2026-11-15" }, ctx);
    const day = await tasks.getMyDay(ctx);
    expect(day.planned.map((t) => t.title).sort()).toEqual(["Due", "Planned"]);
    expect(day.overdue.map((t) => t.title)).toEqual(["Late"]);
  });

  it("persists manual ordering", async () => {
    const a = await tasks.createTask({ title: "A" }, ctx);
    const b = await tasks.createTask({ title: "B" }, ctx);
    await tasks.reorderTasks([b.id, a.id]);
    expect((await tasks.listTasks({ sort: "manual" }, ctx)).map((t) => t.title)).toEqual(["B", "A"]);
  });
});

describe("notes", () => {
  it("creates, saves, reloads, links and deletes a note", async () => {
    const n = await notes.createNote({ title: "Plan", content: "First" });
    const saved = await notes.saveNoteContent(n.id, { title: "Plan", content: "First\n- [ ] item", baseUpdatedAt: n.updatedAt });
    expect(saved.status).toBe("saved");
    const reloaded = await notes.getNote(n.id);
    expect(reloaded?.content).toBe("First\n- [ ] item");

    const other = await notes.createNote({ title: "Other", content: "See [[Plan]]" });
    await notes.linkNotes(n.id, other.id);
    const withLinks = await notes.getNote(n.id);
    expect(withLinks?.related.map((r) => r.id)).toEqual([other.id]);
    expect(withLinks?.backlinks.map((r) => r.id)).toEqual([other.id]);

    await notes.deleteNote(n.id);
    expect(await notes.getNote(n.id)).toBeNull();
    expect(await db.noteLink.count()).toBe(0);
  });

  it("detects conflicting edits instead of overwriting them", async () => {
    const n = await notes.createNote({ title: "T", content: "v1" });
    const base = n.updatedAt;
    await new Promise((r) => setTimeout(r, 15));
    await notes.saveNoteContent(n.id, { title: "T", content: "v2 from tab A", baseUpdatedAt: base });
    const res = await notes.saveNoteContent(n.id, { title: "T", content: "v2 from tab B", baseUpdatedAt: base });
    expect(res.status).toBe("conflict");
    expect((await notes.getNote(n.id))?.content).toBe("v2 from tab A");
    const forced = await notes.saveNoteContent(n.id, { title: "T", content: "v2 from tab B", baseUpdatedAt: base, force: true });
    expect(forced.status).toBe("saved");
  });

  it("searches title and content, archives and restores", async () => {
    const n = await notes.createNote({ title: "Organic chemistry", content: "Benzene rings and aromaticity" });
    expect((await notes.listNotes({ q: "aromatic" })).map((x) => x.id)).toEqual([n.id]);
    await notes.archiveNote(n.id, true);
    expect(await notes.listNotes({ q: "aromatic" })).toHaveLength(0);
    expect(await notes.listNotes({ archived: true })).toHaveLength(1);
    await notes.archiveNote(n.id, false);
    expect(await notes.listNotes({})).toHaveLength(1);
  });

  it("returns one journal entry per day", async () => {
    const tpl = (d: string) => ({ title: d, content: "" });
    const a = await notes.getOrCreateJournal("2026-10-29", tpl);
    const b = await notes.getOrCreateJournal("2026-10-29", tpl);
    expect(a).toBe(b);
  });
});

describe("inbox", () => {
  it("converts an idea into a task in a project, removing it from the inbox", async () => {
    const p = await projects.createProject({ name: "Internship" });
    const item = await inbox.createInboxItem({ content: "Ask about return offer\nBring it up at 1:1" });
    expect((await inbox.getInbox()).count).toBe(1);
    const r = await inbox.convertInboxItem(item.id, "task", { projectId: p.id, tags: ["career"] });
    const t = await tasks.getTask(r.id);
    expect(t).toMatchObject({ title: "Ask about return offer", description: "Bring it up at 1:1", inbox: false });
    expect(t?.project?.id).toBe(p.id);
    expect((await inbox.getInbox()).count).toBe(0);
  });

  it("organizing an inbox task by assigning a project clears its inbox flag", async () => {
    const p = await projects.createProject({ name: "Home" });
    const t = await tasks.createTask({ title: "Fix tap", inbox: true }, ctx);
    expect((await inbox.getInbox()).tasks).toHaveLength(1);
    await tasks.updateTask({ id: t.id, projectId: p.id }, ctx);
    expect((await inbox.getInbox()).tasks).toHaveLength(0);
  });
});

describe("reminders", () => {
  it("claims due reminders once, snoozes and reschedules them", async () => {
    const r = await reminders.createReminder({ title: "Stretch", remindAt: new Date(Date.now() - 1000) });
    const first = await reminders.claimDueReminders();
    expect(first.map((x) => x.id)).toEqual([r.id]);
    expect(await reminders.claimDueReminders()).toHaveLength(0); // no duplicate notifications
    expect((await reminders.getDueReminders()).map((x) => x.id)).toEqual([r.id]); // still due until handled

    const snoozed = await reminders.snoozeReminder(r.id, 10);
    expect(new Date(snoozed.remindAt).getTime()).toBeGreaterThan(Date.now() + 9 * 60_000);
    expect(snoozed.notifiedAt).toBeNull();

    const at = new Date(Date.now() + 86_400_000);
    const moved = await reminders.updateReminder({ id: r.id, remindAt: at });
    expect(moved.remindAt).toBe(at.toISOString());
    expect(moved.status).toBe("pending");
  });

  it("resolving a recurring reminder schedules the next one and keeps history", async () => {
    const r = await reminders.createReminder({
      title: "Weekly review",
      remindAt: new Date("2026-10-29T09:00:00Z"),
      recurrence: { freq: "weekly", interval: 1 },
    });
    const { reminder, next } = await reminders.resolveReminder(r.id, "done", "UTC");
    expect(reminder.status).toBe("done");
    expect(next).not.toBeNull();
    expect(new Date(next!.remindAt).getTime()).toBeGreaterThan(Date.now());
    expect(new Date(next!.remindAt).getUTCHours()).toBe(9);
  });

  it("completing a task completes its pending reminders", async () => {
    const t = await tasks.createTask({ title: "Call bank", remindAt: new Date(Date.now() + 3_600_000) }, ctx);
    await tasks.setTaskStatus(t.id, "done", ctx);
    expect(await db.reminder.count({ where: { taskId: t.id, status: "pending" } })).toBe(0);
  });

  it("sets and clears a task's reminder", async () => {
    const t = await tasks.createTask({ title: "Dentist" }, ctx);
    await reminders.setTaskReminder(t.id, new Date("2026-11-01T10:00:00Z"));
    await reminders.setTaskReminder(t.id, new Date("2026-11-01T11:00:00Z"));
    expect(await db.reminder.count({ where: { taskId: t.id } })).toBe(1);
    await reminders.setTaskReminder(t.id, null);
    expect(await db.reminder.count({ where: { taskId: t.id } })).toBe(0);
  });
});

describe("projects", () => {
  it("reports progress and keeps tasks when deleted", async () => {
    const p = await projects.createProject({ name: "Course" });
    const a = await tasks.createTask({ title: "HW1", projectId: p.id }, ctx);
    await tasks.createTask({ title: "HW2", projectId: p.id }, ctx);
    await tasks.setTaskStatus(a.id, "done", ctx);
    const [dto] = await projects.listProjects();
    expect(dto).toMatchObject({ openTasks: 1, doneTasks: 1 });
    await projects.deleteProject(p.id);
    expect(await db.task.count()).toBe(2);
    expect(await db.task.count({ where: { projectId: { not: null } } })).toBe(0);
  });
});

describe("search", () => {
  it("groups results by type and ranks title matches first", async () => {
    await tasks.createTask({ title: "Something else", description: "mentions calculus inside" }, ctx);
    await tasks.createTask({ title: "Calculus problem set" }, ctx);
    await notes.createNote({ title: "Lecture 3", content: "Limits and calculus basics" });
    await projects.createProject({ name: "Calculus II" });
    const r = await searchAll("calculus");
    expect(r.tasks[0].title).toBe("Calculus problem set");
    expect(r.tasks).toHaveLength(2);
    expect(r.notes[0].snippet.toLowerCase()).toContain("calculus");
    expect(r.projects).toHaveLength(1);
  });
});

describe("settings", () => {
  it("persists settings and normalizes the dashboard layout", async () => {
    await updateSettings({ theme: "dark", accent: "teal", displayName: "Sam", timezone: "Europe/Berlin" });
    const s = await getSettings();
    expect(s).toMatchObject({ theme: "dark", accent: "teal", displayName: "Sam", tz: "Europe/Berlin" });
    expect(s.dashboardLayout.length).toBeGreaterThan(5);
    await expect(updateSettings({ timezone: "Mars/Olympus" })).rejects.toThrow();
  });
});

describe("backup", () => {
  it("exports and re-imports everything, and merge never overwrites existing data", async () => {
    const p = await projects.createProject({ name: "P" });
    const n = await notes.createNote({ title: "N", content: "body", tags: ["t1"], projectId: p.id });
    await tasks.createTask({ title: "T", tags: ["t1"], projectId: p.id, noteId: n.id, subtasks: ["s"] }, ctx);
    await reminders.createReminder({ title: "R", remindAt: new Date("2026-11-01T10:00:00Z") });
    await inbox.createInboxItem({ content: "idea" });
    const backup = JSON.parse(JSON.stringify(await exportAll()));

    // Merge into the same database: everything already exists, nothing is added or changed.
    await notes.saveNoteContent(n.id, { title: "N", content: "edited locally" });
    const dry = await importBackup(backup, "merge", true);
    expect(dry.counts.notes).toMatchObject({ incoming: 1, added: 0, skipped: 1 });
    await importBackup(backup, "merge", false);
    expect((await notes.getNote(n.id))?.content).toBe("edited locally");

    // Restore into an empty database.
    await reset();
    const summary = await importBackup(backup, "merge", false);
    expect(summary.counts.tasks.added).toBe(1);
    const [task] = await tasks.listTasks({}, ctx);
    expect(task).toMatchObject({ title: "T", subtaskCount: 1 });
    expect(task.project?.id).toBe(p.id);
    expect(task.note?.id).toBe(n.id);
    expect(task.tags.map((t) => t.name)).toEqual(["t1"]);
    expect(await db.reminder.count()).toBe(1);
    expect(await db.inboxItem.count()).toBe(1);
  });

  it("rejects invalid backups without changing data", async () => {
    await tasks.createTask({ title: "keep me" }, ctx);
    await expect(importBackup({ app: "other" }, "replace", false)).rejects.toThrow(/not a valid/);
    expect(await db.task.count()).toBe(1);
  });

  it("builds a valid ICS file", async () => {
    await tasks.createTask({ title: "Exam; room 4, hall", dueDate: "2026-11-02" }, ctx);
    await tasks.createTask({ title: "Timed", dueDate: "2026-11-02", dueTime: "09:30" }, ctx);
    const ics = await buildIcs("UTC");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("SUMMARY:Exam\\; room 4\\, hall");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261102");
    expect(ics).toContain("DTSTART:20261102T093000Z");
  });
});
