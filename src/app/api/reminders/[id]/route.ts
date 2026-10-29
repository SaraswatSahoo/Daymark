import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveReminder, snoozeReminder } from "@/server/services/reminders";
import { getSettings } from "@/server/services/settings";
import { assertSameOrigin, jsonError, readJson } from "@/server/http";

const bodySchema = z.object({
  action: z.enum(["done", "dismiss", "snooze"]),
  minutes: z.number().int().min(1).max(7 * 24 * 60).optional(),
});

/** Lets notification buttons (service worker) act on a reminder without opening the app. */
export async function POST(request: Request, ctx: RouteContext<"/api/reminders/[id]">) {
  try {
    assertSameOrigin(request);
    const { id } = await ctx.params;
    const body = bodySchema.parse(await readJson(request, 2_000));
    const settings = await getSettings();
    if (body.action === "snooze") await snoozeReminder(id, body.minutes ?? settings.defaultSnoozeMinutes);
    else await resolveReminder(id, body.action === "done" ? "done" : "dismissed", settings.tz);
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
