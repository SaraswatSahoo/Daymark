import { NextResponse } from "next/server";
import { claimDueReminders, getDueReminders, nextPendingReminderAt } from "@/server/services/reminders";
import { assertSameOrigin, jsonError } from "@/server/http";

/**
 * Called by the in-app notifier every ~30s and when the tab regains focus.
 * Returns newly due reminders (claimed so other tabs don't repeat them), the full
 * list of due-but-unhandled reminders, and when the next one is scheduled.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const [fresh, due, nextAt] = await Promise.all([claimDueReminders(), getDueReminders(), nextPendingReminderAt()]);
    return NextResponse.json({ fresh, due, nextAt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
