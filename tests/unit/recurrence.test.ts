import { describe, expect, it } from "vitest";
import {
  describeRecurrence,
  nextOccurrenceDate,
  nextReminderInstant,
  nextTaskDueDate,
  parseRecurrence,
  serializeRecurrence,
} from "@/lib/recurrence";

describe("recurrence rules", () => {
  it("round-trips and rejects invalid rules", () => {
    const raw = serializeRecurrence({ freq: "weekly", interval: 2 });
    expect(parseRecurrence(raw)).toEqual({ freq: "weekly", interval: 2 });
    expect(parseRecurrence('{"freq":"hourly","interval":1}')).toBeNull();
    expect(parseRecurrence("not json")).toBeNull();
    expect(parseRecurrence(null)).toBeNull();
  });

  it("describes rules", () => {
    expect(describeRecurrence({ freq: "daily", interval: 1 })).toBe("Every day");
    expect(describeRecurrence({ freq: "weekly", interval: 3 })).toBe("Every 3 weeks");
    expect(describeRecurrence(null)).toBe("Does not repeat");
  });

  it("computes the next calendar occurrence", () => {
    expect(nextOccurrenceDate("2026-10-29", { freq: "daily", interval: 1 })).toBe("2026-10-30");
    expect(nextOccurrenceDate("2026-10-29", { freq: "daily", interval: 3 })).toBe("2026-11-01");
    expect(nextOccurrenceDate("2026-10-29", { freq: "weekly", interval: 2 })).toBe("2026-11-12");
    expect(nextOccurrenceDate("2026-01-31", { freq: "monthly", interval: 1 })).toBe("2026-02-28");
    expect(nextOccurrenceDate("2028-02-29", { freq: "yearly", interval: 1 })).toBe("2029-02-28");
  });

  it("skips weekends for weekday rules", () => {
    expect(nextOccurrenceDate("2026-10-30", { freq: "weekdays", interval: 1 })).toBe("2026-11-02"); // Fri → Mon
    expect(nextOccurrenceDate("2026-10-27", { freq: "weekdays", interval: 1 })).toBe("2026-10-28");
  });

  it("does not schedule a completed-late recurring task in the past", () => {
    // Daily task due 5 days ago, completed today → next is tomorrow, not 4 days ago.
    expect(nextTaskDueDate("2026-10-24", { freq: "daily", interval: 1 }, "2026-10-29")).toBe("2026-10-29");
    expect(nextTaskDueDate("2026-10-01", { freq: "weekly", interval: 1 }, "2026-10-29")).toBe("2026-10-29");
    expect(nextTaskDueDate("2026-10-29", { freq: "weekly", interval: 1 }, "2026-10-29")).toBe("2026-11-05");
  });

  it("keeps reminder wall-clock time across DST", () => {
    const tz = "America/New_York";
    // 9:00 EDT on Oct 31 → next day is 9:00 EDT, then Nov 1 is still EDT→EST switch day (Nov 1, 2026).
    const from = new Date("2026-10-31T13:00:00Z");
    const next = nextReminderInstant(from, { freq: "daily", interval: 1 }, tz, new Date("2026-10-31T14:00:00Z"));
    expect(next.toISOString()).toBe("2026-11-01T14:00:00.000Z"); // 9:00 EST
  });

  it("skips past reminder occurrences", () => {
    const from = new Date("2026-10-01T09:00:00Z");
    const now = new Date("2026-10-29T12:00:00Z");
    const next = nextReminderInstant(from, { freq: "daily", interval: 1 }, "UTC", now);
    expect(next.toISOString()).toBe("2026-10-30T09:00:00.000Z");
  });
});
