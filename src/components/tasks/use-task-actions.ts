"use client";

import { toast } from "sonner";
import { act } from "@/lib/client/action";
import {
  archiveTaskAction,
  deleteTaskAction,
  duplicateTaskAction,
  setTaskStatusAction,
  toggleMyDayAction,
  updateTaskAction,
} from "@/server/actions/tasks";
import { relativeDayLabel } from "@/lib/dates";
import { useApp } from "@/components/app/app-context";
import type { TaskDTO } from "@/lib/types";
import type { TaskUpdateInput } from "@/lib/validation";

/** Shared task mutations with consistent feedback (success only after the server confirms). */
export function useTaskActions() {
  const { today, openTask } = useApp();

  const setDone = async (task: Pick<TaskDTO, "id" | "title">, done: boolean) => {
    const result = await act(setTaskStatusAction(task.id, done ? "done" : "todo"));
    if (!result) return false;
    if (done) {
      toast.success("Task completed", {
        description: result.next?.dueDate ? `Next occurrence: ${relativeDayLabel(result.next.dueDate, today)}` : undefined,
        action: { label: "Undo", onClick: () => void act(setTaskStatusAction(task.id, "todo")) },
      });
    }
    return true;
  };

  const update = (input: TaskUpdateInput, success?: string) => act(updateTaskAction(input), { success });

  const toggleMyDay = (task: TaskDTO) =>
    act(toggleMyDayAction(task.id, task.myDayDate !== today), {
      success: task.myDayDate === today ? "Removed from My Day" : "Added to My Day",
    });

  const archive = (task: TaskDTO) =>
    act(archiveTaskAction(task.id, true), {
      success: "Task archived",
      undo: () => void act(archiveTaskAction(task.id, false)),
    });

  const remove = (task: TaskDTO) => act(deleteTaskAction(task.id), { success: "Task deleted" });

  const duplicate = async (task: TaskDTO) => {
    const copy = await act(duplicateTaskAction(task.id), { success: "Task duplicated" });
    if (copy) openTask(copy.id);
  };

  return { setDone, update, toggleMyDay, archive, remove, duplicate };
}
