"use server";

import { z } from "zod";
import { run, UserError } from "../action-result";
import { refreshAll, taskContext } from "./context";
import * as tasks from "../services/tasks";
import { setTaskReminder } from "../services/reminders";
import { id, instant, type TaskCreateInput, type TaskUpdateInput } from "@/lib/validation";
import { TASK_STATUSES } from "@/lib/constants";

export async function createTaskAction(input: TaskCreateInput) {
  return run(async () => {
    const task = await tasks.createTask(input, await taskContext());
    refreshAll();
    return task;
  });
}

export async function updateTaskAction(input: TaskUpdateInput) {
  return run(async () => {
    const task = await tasks.updateTask(input, await taskContext());
    refreshAll();
    return task;
  });
}

export async function setTaskStatusAction(taskId: string, status: string) {
  return run(async () => {
    const parsed = z.object({ taskId: id, status: z.enum(TASK_STATUSES) }).parse({ taskId, status });
    const result = await tasks.setTaskStatus(parsed.taskId, parsed.status, await taskContext());
    refreshAll();
    return result;
  });
}

export async function toggleMyDayAction(taskId: string, inMyDay: boolean) {
  return run(async () => {
    const task = await tasks.updateTask({ id: id.parse(taskId), myDay: inMyDay }, await taskContext());
    refreshAll();
    return task;
  });
}

export async function getTaskAction(taskId: string) {
  return run(async () => {
    const task = await tasks.getTask(id.parse(taskId));
    if (!task) throw new UserError("That task no longer exists.");
    return task;
  });
}

export async function archiveTaskAction(taskId: string, archived: boolean) {
  return run(async () => {
    await tasks.archiveTask(id.parse(taskId), archived);
    refreshAll();
  });
}

export async function deleteTaskAction(taskId: string) {
  return run(async () => {
    await tasks.deleteTask(id.parse(taskId));
    refreshAll();
  });
}

export async function duplicateTaskAction(taskId: string) {
  return run(async () => {
    const task = await tasks.duplicateTask(id.parse(taskId), await taskContext());
    refreshAll();
    return task;
  });
}

export async function reorderTasksAction(ids: string[]) {
  return run(async () => {
    await tasks.reorderTasks(z.array(id).max(1000).parse(ids));
    refreshAll();
  });
}

export async function addSubtaskAction(taskId: string, title: string) {
  return run(async () => {
    const s = await tasks.addSubtask({ taskId, title });
    refreshAll();
    return s;
  });
}

export async function addSubtasksAction(taskId: string, titles: string[]) {
  return run(async () => {
    const n = await tasks.addSubtasks(id.parse(taskId), z.array(z.string().max(300)).max(20).parse(titles));
    refreshAll();
    return n;
  });
}

export async function updateSubtaskAction(subtaskId: string, patch: { title?: string; done?: boolean }) {
  return run(async () => {
    const parsed = z.object({ title: z.string().max(300).optional(), done: z.boolean().optional() }).parse(patch);
    const s = await tasks.updateSubtask(id.parse(subtaskId), parsed);
    refreshAll();
    return s;
  });
}

export async function deleteSubtaskAction(subtaskId: string) {
  return run(async () => {
    await tasks.deleteSubtask(id.parse(subtaskId));
    refreshAll();
  });
}

export async function setTaskReminderAction(taskId: string, remindAt: string | null) {
  return run(async () => {
    const at = remindAt ? instant.parse(remindAt) : null;
    const r = await setTaskReminder(id.parse(taskId), at);
    refreshAll();
    return r;
  });
}

export async function searchTaskOptionsAction(query: string) {
  return run(() => tasks.listTaskOptions(z.string().max(200).parse(query)));
}
