"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { useApp } from "@/components/app/app-context";
import { formatISO, formatTime, isoDateInTz, timeInTz } from "@/lib/dates";

/**
 * Relative time ("5 minutes ago"). The text depends on the current moment, so the
 * server and browser may differ by a second; hydration warnings are suppressed for
 * this element only. The absolute time (in the user's timezone) is in the tooltip.
 */
export function TimeAgo({ date, className }: { date: string | Date; className?: string }) {
  const { settings } = useApp();
  const d = typeof date === "string" ? new Date(date) : date;
  return (
    <time dateTime={d.toISOString()} title={formatDateTime(d, settings.tz, settings.timeFormat)} className={className} suppressHydrationWarning>
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  );
}

/** Absolute date and time in an explicit timezone — identical on server and client. */
export function formatDateTime(d: Date, tz: string, timeFormat: string): string {
  return `${formatISO(isoDateInTz(d, tz), "MMM d, yyyy")}, ${formatTime(timeInTz(d, tz), timeFormat)}`;
}

export function DateTime({ date }: { date: string | Date }) {
  const { settings } = useApp();
  const d = typeof date === "string" ? new Date(date) : date;
  return <time dateTime={d.toISOString()}>{formatDateTime(d, settings.tz, settings.timeFormat)}</time>;
}
