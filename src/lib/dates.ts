/**
 * Date helpers.
 *
 * Calendar days are represented as ISO strings ("YYYY-MM-DD"). Arithmetic on them is
 * done in UTC so it never shifts across DST transitions. "Today" is always computed
 * in the user's configured timezone.
 */
import { TZDate, tzOffset } from "@date-fns/tz";
import { format } from "date-fns";

export type ISODate = string; // YYYY-MM-DD

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isISODate(value: string): boolean {
  if (!ISO_RE.test(value)) return false;
  const d = parseISODateUTC(value);
  return !Number.isNaN(d.getTime()) && toISODateUTC(d) === value;
}

export function isTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function parseISODateUTC(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function toISODateUTC(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

export function addDaysISO(iso: ISODate, days: number): ISODate {
  const d = parseISODateUTC(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODateUTC(d);
}

/** Adds calendar months, clamping to the last day of the target month (Jan 31 + 1 → Feb 28/29). */
export function addMonthsISO(iso: ISODate, months: number): ISODate {
  const [y, m, d] = iso.split("-").map(Number);
  const targetMonthIndex = m - 1 + months;
  const ty = y + Math.floor(targetMonthIndex / 12);
  const tm = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  return toISODateUTC(new Date(Date.UTC(ty, tm, Math.min(d, lastDay))));
}

export function diffDaysISO(a: ISODate, b: ISODate): number {
  return Math.round((parseISODateUTC(a).getTime() - parseISODateUTC(b).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayISO(iso: ISODate): number {
  return parseISODateUTC(iso).getUTCDay();
}

export function startOfWeekISO(iso: ISODate, weekStart: number): ISODate {
  const wd = weekdayISO(iso);
  const diff = (wd - weekStart + 7) % 7;
  return addDaysISO(iso, -diff);
}

export function startOfMonthISO(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function rangeISO(start: ISODate, days: number): ISODate[] {
  return Array.from({ length: days }, (_, i) => addDaysISO(start, i));
}

export function resolveTimezone(tz: string | null | undefined): string {
  if (tz && isValidTimezone(tz)) return tz;
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date of an instant in a timezone. */
export function isoDateInTz(instant: Date, tz: string): ISODate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** HH:mm of an instant in a timezone. */
export function timeInTz(instant: Date, tz: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

export function todayISO(tz: string, now: Date = new Date()): ISODate {
  return isoDateInTz(now, tz);
}

/** Converts a wall-clock date + time in `tz` to a UTC instant. */
export function zonedToInstant(date: ISODate, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(new TZDate(y, m - 1, d, hh, mm, 0, 0, tz).getTime());
}

/** UTC instant for the start of a calendar day in `tz`. */
export function startOfDayInstant(date: ISODate, tz: string): Date {
  return zonedToInstant(date, "00:00", tz);
}

/** Offset of `tz` from UTC in minutes at `at`. */
export function tzOffsetMinutes(tz: string, at: Date = new Date()): number {
  return tzOffset(tz, at);
}

export function formatTime(time: string, timeFormat: string): string {
  if (timeFormat === "24h") return time;
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

export function formatISO(iso: ISODate, pattern: string): string {
  return format(parseISODateUTCAsLocal(iso), pattern);
}

/** A local Date with the same Y/M/D, suitable for date-fns formatting (no tz shift). */
export function parseISODateUTCAsLocal(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function localDateToISO(date: Date): ISODate {
  return format(date, "yyyy-MM-dd");
}

/** Short, human relative label for a calendar day: Today, Tomorrow, Yesterday, Mon, Oct 30, Oct 30 2027. */
export function relativeDayLabel(iso: ISODate, today: ISODate): string {
  const diff = diffDaysISO(iso, today);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const local = parseISODateUTCAsLocal(iso);
  if (diff > 1 && diff < 7) return format(local, "EEEE");
  if (iso.slice(0, 4) === today.slice(0, 4)) return format(local, "EEE, MMM d");
  return format(local, "MMM d, yyyy");
}

export function formatInstant(instant: Date, tz: string, today: ISODate, timeFormat: string): string {
  const day = isoDateInTz(instant, tz);
  return `${relativeDayLabel(day, today)} · ${formatTime(timeInTz(instant, tz), timeFormat)}`;
}

export function greetingFor(time: string): string {
  const hour = Number(time.slice(0, 2));
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
