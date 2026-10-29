/**
 * Quick-capture parser. Turns "Submit essay tomorrow 5pm #school !high +Thesis"
 * into structured fields. Everything is optional: unparsed text is simply the title.
 *
 * Supported tokens
 * - Dates/times in natural language ("tomorrow", "next fri 9am", "in 2 hours", "Oct 3")
 * - #tag
 * - !low  !medium (!med)  !high  !urgent
 * - +project (matches an existing project by name; use - or _ for spaces)
 * - A leading type prefix: "task:", "note:", "remind:"/"reminder:", "idea:"
 */
import * as chrono from "chrono-node";
import { tzOffsetMinutes, type ISODate } from "./dates";
import type { Priority } from "./constants";

export type CaptureKind = "task" | "note" | "reminder" | "idea";

export interface ParsedCapture {
  title: string;
  kind?: CaptureKind;
  tags: string[];
  priority?: Priority;
  date?: ISODate;
  time?: string;
  dateText?: string;
  projectId?: string;
  projectName?: string;
}

const PRIORITY_TOKENS: Record<string, Priority> = {
  low: 0,
  med: 1,
  medium: 1,
  high: 2,
  urgent: 3,
};

const KIND_PREFIX = /^(task|todo|note|remind|reminder|idea)\s*:\s*/i;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function parseCapture(
  input: string,
  options: { now?: Date; timezone: string; projects?: { id: string; name: string }[]; parseDates?: boolean },
): ParsedCapture {
  const now = options.now ?? new Date();
  let text = input.trim();
  const result: ParsedCapture = { title: "", tags: [] };

  const kindMatch = text.match(KIND_PREFIX);
  if (kindMatch) {
    const k = kindMatch[1].toLowerCase();
    result.kind = k === "todo" ? "task" : k === "remind" ? "reminder" : (k as CaptureKind);
    text = text.slice(kindMatch[0].length);
  }

  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]{1,40})/gu, (_m, lead: string, tag: string) => {
    if (!result.tags.includes(tag.toLowerCase())) result.tags.push(tag.toLowerCase());
    return lead;
  });

  text = text.replace(/(^|\s)!(low|medium|med|high|urgent)\b/gi, (_m, lead: string, p: string) => {
    result.priority = PRIORITY_TOKENS[p.toLowerCase()];
    return lead;
  });

  if (options.projects?.length) {
    text = text.replace(/(^|\s)\+([\p{L}\p{N}_-]{1,80})/gu, (m, lead: string, name: string) => {
      const wanted = name.replace(/[-_]/g, " ").toLowerCase();
      const project =
        options.projects!.find((p) => p.name.toLowerCase() === wanted) ??
        options.projects!.find((p) => p.name.toLowerCase().startsWith(wanted));
      if (!project) return m;
      result.projectId = project.id;
      result.projectName = project.name;
      return lead;
    });
  }

  if (options.parseDates !== false) {
    const ref = { instant: now, timezone: tzOffsetMinutes(options.timezone, now) };
    const [match] = chrono.parse(text, ref, { forwardDate: true });
    if (match) {
      const s = match.start;
      result.date = `${s.get("year")}-${pad(s.get("month") ?? 1)}-${pad(s.get("day") ?? 1)}`;
      if (s.isCertain("hour")) {
        result.time = `${pad(s.get("hour") ?? 0)}:${pad(s.get("minute") ?? 0)}`;
      }
      result.dateText = match.text;
      text = (text.slice(0, match.index) + " " + text.slice(match.index + match.text.length)).trim();
      // Drop a dangling connector left behind ("Call mom on", "Pay rent by").
      text = text.replace(/\s+(on|at|by|due|for)$/i, "");
    }
  }

  result.title = text.replace(/\s{2,}/g, " ").trim();
  return result;
}
