import "server-only";
import { db } from "../db";
import { addDaysISO, zonedToInstant } from "@/lib/dates";
import { brand } from "@/config/brand";
import { parseRecurrence, type Recurrence } from "@/lib/recurrence";

/** Escapes text per RFC 5545. */
export function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

/** Folds lines longer than 75 octets (approximated by characters). */
function fold(line: string): string {
  if (line.length <= 74) return line;
  const parts: string[] = [];
  for (let i = 0; i < line.length; i += 73) parts.push((i ? " " : "") + line.slice(i, i + 73));
  return parts.join("\r\n");
}

const utcStamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dayStamp = (iso: string) => iso.replace(/-/g, "");

function rrule(rule: Recurrence | null): string | null {
  if (!rule) return null;
  switch (rule.freq) {
    case "weekdays":
      return "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    default:
      return `RRULE:FREQ=${rule.freq.toUpperCase()};INTERVAL=${rule.interval}`;
  }
}

/** iCalendar export of open, dated tasks and pending reminders. */
export async function buildIcs(tz: string): Promise<string> {
  const [tasks, reminders] = await Promise.all([
    db.task.findMany({ where: { archivedAt: null, status: { not: "done" }, dueDate: { not: null } } }),
    db.reminder.findMany({ where: { status: "pending" } }),
  ]);
  const now = utcStamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${brand.name}//Personal Planner//EN`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsEscape(brand.name)}`,
    `X-WR-TIMEZONE:${tz}`,
  ];
  for (const t of tasks) {
    const due = t.dueDate!;
    lines.push("BEGIN:VEVENT", `UID:task-${t.id}@daymark`, `DTSTAMP:${now}`, `SUMMARY:${icsEscape(t.title)}`);
    if (t.dueTime) {
      // Timed tasks are exported as UTC instants (no VTIMEZONE block needed).
      lines.push(`DTSTART:${utcStamp(zonedToInstant(due, t.dueTime, tz))}`, "DURATION:PT30M");
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dayStamp(due)}`, `DTEND;VALUE=DATE:${dayStamp(addDaysISO(due, 1))}`);
    }
    if (t.description) lines.push(`DESCRIPTION:${icsEscape(t.description.slice(0, 2000))}`);
    const rr = rrule(parseRecurrence(t.recurrence));
    if (rr) lines.push(rr);
    lines.push("CATEGORIES:Task", "END:VEVENT");
  }
  for (const r of reminders) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:reminder-${r.id}@daymark`,
      `DTSTAMP:${now}`,
      `SUMMARY:${icsEscape(`⏰ ${r.title}`)}`,
      `DTSTART:${utcStamp(r.remindAt)}`,
      "DURATION:PT15M",
    );
    if (r.description) lines.push(`DESCRIPTION:${icsEscape(r.description.slice(0, 2000))}`);
    const rr = rrule(parseRecurrence(r.recurrence));
    if (rr) lines.push(rr);
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${icsEscape(r.title)}`, "TRIGGER:PT0M", "END:VALARM");
    lines.push("CATEGORIES:Reminder", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
