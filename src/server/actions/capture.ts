"use server";

import { z } from "zod";
import { run, UserError } from "../action-result";
import { refreshAll, taskContext } from "./context";
import { createTask } from "../services/tasks";
import { createNote } from "../services/notes";
import { createReminder } from "../services/reminders";
import { createInboxItem } from "../services/inbox";
import { getSettings } from "../services/settings";
import { zonedToInstant } from "@/lib/dates";
import { id, isoDate, priority, tagName, timeOfDay } from "@/lib/validation";
import { LIMITS } from "@/lib/constants";

const captureSchema = z.object({
  kind: z.enum(["task", "note", "reminder", "idea"]),
  title: z.string().trim().min(1, "Type something to capture").max(LIMITS.inboxContent),
  body: z.string().max(LIMITS.noteContent).optional(),
  date: isoDate.nullish(),
  time: timeOfDay.nullish(),
  tags: z.array(tagName).max(20).optional(),
  priority: priority.optional(),
  projectId: id.nullish(),
  myDay: z.boolean().optional(),
});

export type CaptureInput = z.input<typeof captureSchema>;
export type CaptureResult = { kind: "task" | "note" | "reminder" | "idea"; id: string; inbox: boolean };

/**
 * One entry point for quick capture. Anything captured without a destination
 * (project or date) lands in the Inbox to be organized later.
 */
export async function captureAction(input: CaptureInput) {
  return run<CaptureResult>(async () => {
    const data = captureSchema.parse(input);
    const ctx = await taskContext();
    let result: CaptureResult;

    switch (data.kind) {
      case "task": {
        if (data.title.length > LIMITS.title) throw new UserError("Task titles are limited to 300 characters.");
        const inbox = !data.projectId && !data.date && !data.myDay;
        const task = await createTask(
          {
            title: data.title,
            description: data.body,
            dueDate: data.date ?? null,
            dueTime: data.date ? (data.time ?? null) : null,
            priority: data.priority,
            tags: data.tags,
            projectId: data.projectId ?? null,
            myDay: data.myDay,
            inbox,
          },
          ctx,
        );
        result = { kind: "task", id: task.id, inbox };
        break;
      }
      case "note": {
        const inbox = !data.projectId;
        const note = await createNote({
          title: data.title.slice(0, LIMITS.title),
          content: data.body ?? "",
          tags: data.tags,
          projectId: data.projectId ?? null,
          inbox,
        });
        result = { kind: "note", id: note.id, inbox };
        break;
      }
      case "reminder": {
        if (!data.date) throw new UserError("Choose when to be reminded.");
        const settings = await getSettings();
        const at = zonedToInstant(data.date, data.time ?? settings.defaultReminderTime, ctx.tz);
        const r = await createReminder({
          title: data.title.slice(0, LIMITS.title),
          description: data.body,
          remindAt: at,
          projectId: data.projectId ?? null,
        });
        result = { kind: "reminder", id: r.id, inbox: false };
        break;
      }
      case "idea": {
        const content = data.body ? `${data.title}\n${data.body}` : data.title;
        const item = await createInboxItem({ content });
        result = { kind: "idea", id: item.id, inbox: true };
        break;
      }
    }
    refreshAll();
    return result;
  });
}
