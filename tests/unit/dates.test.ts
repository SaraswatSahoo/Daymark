import { describe, expect, it } from "vitest";
import {
  addDaysISO,
  addMonthsISO,
  diffDaysISO,
  formatTime,
  isISODate,
  isoDateInTz,
  relativeDayLabel,
  startOfWeekISO,
  timeInTz,
  todayISO,
  zonedToInstant,
} from "@/lib/dates";

describe("ISO date arithmetic", () => {
  it("validates real calendar dates only", () => {
    expect(isISODate("2026-02-28")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("2028-02-29")).toBe(true);
    expect(isISODate("26-1-1")).toBe(false);
  });

  it("adds days across month, year and DST boundaries", () => {
    expect(addDaysISO("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysISO("2026-03-08", 1)).toBe("2026-03-09"); // US DST start
    expect(addDaysISO("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("clamps month addition to the last day of the month", () => {
    expect(addMonthsISO("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsISO("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonthsISO("2026-11-15", 3)).toBe("2027-02-15");
    expect(addMonthsISO("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("computes week starts for Monday and Sunday weeks", () => {
    // 2026-10-29 is a Thursday
    expect(startOfWeekISO("2026-10-29", 1)).toBe("2026-10-26");
    expect(startOfWeekISO("2026-10-29", 0)).toBe("2026-10-25");
    expect(startOfWeekISO("2026-10-26", 1)).toBe("2026-10-26");
  });

  it("diffs days", () => {
    expect(diffDaysISO("2026-11-01", "2026-10-29")).toBe(3);
  });
});

describe("timezone handling", () => {
  const instant = new Date("2026-10-29T23:30:00Z");

  it("computes today in the user's timezone, not the server's", () => {
    expect(todayISO("UTC", instant)).toBe("2026-10-29");
    expect(todayISO("Asia/Kolkata", instant)).toBe("2026-10-30"); // UTC+5:30
    expect(todayISO("America/Los_Angeles", instant)).toBe("2026-10-29");
    expect(isoDateInTz(new Date("2026-10-30T02:00:00Z"), "America/New_York")).toBe("2026-10-29");
  });

  it("converts wall-clock times to instants, respecting DST", () => {
    expect(zonedToInstant("2026-07-01", "09:00", "America/New_York").toISOString()).toBe("2026-07-01T13:00:00.000Z");
    expect(zonedToInstant("2026-12-01", "09:00", "America/New_York").toISOString()).toBe("2026-12-01T14:00:00.000Z");
    expect(zonedToInstant("2026-10-30", "09:00", "Asia/Kolkata").toISOString()).toBe("2026-10-30T03:30:00.000Z");
    expect(timeInTz(new Date("2026-10-30T03:30:00Z"), "Asia/Kolkata")).toBe("09:00");
  });
});

describe("formatting", () => {
  it("labels relative days", () => {
    expect(relativeDayLabel("2026-10-29", "2026-10-29")).toBe("Today");
    expect(relativeDayLabel("2026-10-30", "2026-10-29")).toBe("Tomorrow");
    expect(relativeDayLabel("2026-10-28", "2026-10-29")).toBe("Yesterday");
    expect(relativeDayLabel("2026-11-02", "2026-10-29")).toBe("Monday");
    expect(relativeDayLabel("2026-12-25", "2026-10-29")).toBe("Fri, Dec 25");
    expect(relativeDayLabel("2027-01-05", "2026-10-29")).toBe("Jan 5, 2027");
  });

  it("formats times in 12h and 24h", () => {
    expect(formatTime("09:00", "12h")).toBe("9am");
    expect(formatTime("13:05", "12h")).toBe("1:05pm");
    expect(formatTime("00:30", "12h")).toBe("12:30am");
    expect(formatTime("13:05", "24h")).toBe("13:05");
  });
});
