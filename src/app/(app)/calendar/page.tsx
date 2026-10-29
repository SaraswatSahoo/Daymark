import type { Metadata } from "next";
import { getTasksInRange } from "@/server/services/tasks";
import { getRemindersInRange } from "@/server/services/reminders";
import { taskContext } from "@/server/actions/context";
import { CalendarView, type CalendarViewMode } from "@/components/calendar/calendar-view";
import { addDaysISO, isISODate, startOfDayInstant, startOfMonthISO, startOfWeekISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const sp = await searchParams;
  const ctx = await taskContext();
  const view: CalendarViewMode = sp.view === "week" || sp.view === "day" ? sp.view : "month";
  const date = typeof sp.date === "string" && isISODate(sp.date) ? sp.date : ctx.today;

  let from: string;
  let days: number;
  if (view === "month") {
    from = startOfWeekISO(startOfMonthISO(date), ctx.weekStart);
    days = 42;
  } else if (view === "week") {
    from = startOfWeekISO(date, ctx.weekStart);
    days = 7;
  } else {
    from = date;
    days = 7; // the day plus a short look-ahead agenda
  }
  const to = addDaysISO(from, days - 1);
  const [tasks, reminders] = await Promise.all([
    getTasksInRange(from, to),
    getRemindersInRange(startOfDayInstant(from, ctx.tz), startOfDayInstant(addDaysISO(to, 1), ctx.tz)),
  ]);

  return <CalendarView view={view} date={date} from={from} days={days} tasks={tasks} reminders={reminders} />;
}
