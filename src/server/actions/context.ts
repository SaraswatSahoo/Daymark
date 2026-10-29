import "server-only";
import { revalidatePath } from "next/cache";
import { getToday } from "../services/settings";
import type { TaskContext } from "../services/tasks";

export async function taskContext(): Promise<TaskContext & { weekStart: number }> {
  const { settings, today } = await getToday();
  return { today, tz: settings.tz, weekStart: settings.weekStart, defaultPriority: settings.defaultPriority };
}

/** Every view shares sidebar counts and dashboard data, so mutations refresh the whole tree. */
export function refreshAll() {
  revalidatePath("/", "layout");
}
