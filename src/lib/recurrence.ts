import { z } from "zod";
import { TZDate } from "@date-fns/tz";
import { addDays, addMonths, addWeeks, addYears } from "date-fns";
import { addDaysISO, addMonthsISO, weekdayISO, type ISODate } from "./dates";

export const RECURRENCE_FREQS = ["daily", "weekdays", "weekly", "monthly", "yearly"] as const;
export type RecurrenceFreq = (typeof RECURRENCE_FREQS)[number];

export const recurrenceSchema = z.object({
  freq: z.enum(RECURRENCE_FREQS),
  interval: z.number().int().min(1).max(365).default(1),
});
export type Recurrence = z.infer<typeof recurrenceSchema>;

export function parseRecurrence(raw: string | null | undefined): Recurrence | null {
  if (!raw) return null;
  try {
    const parsed = recurrenceSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function serializeRecurrence(rule: Recurrence | null | undefined): string | null {
  return rule ? JSON.stringify({ freq: rule.freq, interval: rule.interval }) : null;
}

export function describeRecurrence(rule: Recurrence | null): string {
  if (!rule) return "Does not repeat";
  const n = rule.interval;
  switch (rule.freq) {
    case "daily":
      return n === 1 ? "Every day" : `Every ${n} days`;
    case "weekdays":
      return "Every weekday";
    case "weekly":
      return n === 1 ? "Every week" : `Every ${n} weeks`;
    case "monthly":
      return n === 1 ? "Every month" : `Every ${n} months`;
    case "yearly":
      return n === 1 ? "Every year" : `Every ${n} years`;
  }
}

/** Next calendar date after `from` for a date-based rule. */
export function nextOccurrenceDate(from: ISODate, rule: Recurrence): ISODate {
  switch (rule.freq) {
    case "daily":
      return addDaysISO(from, rule.interval);
    case "weekdays": {
      let next = addDaysISO(from, 1);
      while (weekdayISO(next) === 0 || weekdayISO(next) === 6) next = addDaysISO(next, 1);
      return next;
    }
    case "weekly":
      return addDaysISO(from, 7 * rule.interval);
    case "monthly":
      return addMonthsISO(from, rule.interval);
    case "yearly":
      return addMonthsISO(from, 12 * rule.interval);
  }
}

/**
 * Next occurrence date for a recurring task when it is completed. The schedule is
 * anchored to the due date; if the task was completed late, occurrences that are
 * already in the past are skipped so the next one lands today or later.
 */
export function nextTaskDueDate(dueDate: ISODate, rule: Recurrence, today: ISODate): ISODate {
  let next = nextOccurrenceDate(dueDate, rule);
  let guard = 0;
  while (next < today && guard < 1000) {
    next = nextOccurrenceDate(next, rule);
    guard++;
  }
  return next;
}

/**
 * Next instant for a recurring reminder, keeping the same wall-clock time in `tz`
 * across DST changes, and skipping occurrences that are already in the past.
 */
export function nextReminderInstant(from: Date, rule: Recurrence, tz: string, now: Date = new Date()): Date {
  const step = (d: TZDate): TZDate => {
    switch (rule.freq) {
      case "daily":
        return addDays(d, rule.interval);
      case "weekdays": {
        let n = addDays(d, 1);
        while (n.getDay() === 0 || n.getDay() === 6) n = addDays(n, 1);
        return n;
      }
      case "weekly":
        return addWeeks(d, rule.interval);
      case "monthly":
        return addMonths(d, rule.interval);
      case "yearly":
        return addYears(d, rule.interval);
    }
  };
  let next = step(new TZDate(from.getTime(), tz));
  let guard = 0;
  while (next.getTime() <= now.getTime() && guard < 5000) {
    next = step(next);
    guard++;
  }
  return new Date(next.getTime());
}
