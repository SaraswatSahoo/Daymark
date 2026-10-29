import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboard } from "@/server/services/dashboard";
import { taskContext } from "@/server/actions/context";
import { greetingFor, timeInTz } from "@/lib/dates";

export default async function HomePage() {
  const ctx = await taskContext();
  const data = await getDashboard(ctx);
  return (
    <DashboardView
      greeting={greetingFor(timeInTz(new Date(), ctx.tz))}
      focus={data.focus}
      dueToday={data.dueToday}
      overdue={data.overdue}
      progress={data.progress}
      reminders={data.reminders}
      recentNotes={data.recentNotes}
      inbox={data.inbox}
      week={data.week}
    />
  );
}
