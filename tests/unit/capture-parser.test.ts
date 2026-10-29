import { describe, expect, it } from "vitest";
import { parseCapture } from "@/lib/capture-parser";

// Thursday, 2026-10-29 at 10:00 in New York.
const now = new Date("2026-10-29T14:00:00Z");
const opts = { now, timezone: "America/New_York" };

describe("quick-capture parser", () => {
  it("returns plain text unchanged", () => {
    expect(parseCapture("Buy groceries", opts)).toMatchObject({ title: "Buy groceries", tags: [] });
  });

  it("extracts natural-language dates and times", () => {
    const r = parseCapture("Submit essay tomorrow at 5pm", opts);
    expect(r.title).toBe("Submit essay");
    expect(r.date).toBe("2026-10-30");
    expect(r.time).toBe("17:00");
  });

  it("uses the user's timezone for 'today'", () => {
    // 2026-10-30 01:00 UTC is still Oct 29 in New York but Oct 30 in Kolkata.
    const late = new Date("2026-10-30T01:00:00Z");
    expect(parseCapture("call today", { now: late, timezone: "America/New_York" }).date).toBe("2026-10-29");
    expect(parseCapture("call today", { now: late, timezone: "Asia/Kolkata" }).date).toBe("2026-10-30");
  });

  it("leaves time undefined for date-only phrases", () => {
    const r = parseCapture("Pay rent on friday", opts);
    expect(r.date).toBe("2026-10-30");
    expect(r.time).toBeUndefined();
    expect(r.title).toBe("Pay rent");
  });

  it("extracts tags, priority and project", () => {
    const r = parseCapture("Read chapter 4 #school #Reading !high +thesis", {
      ...opts,
      projects: [{ id: "p1", name: "Thesis" }],
    });
    expect(r.title).toBe("Read chapter 4");
    expect(r.tags).toEqual(["school", "reading"]);
    expect(r.priority).toBe(2);
    expect(r.projectId).toBe("p1");
  });

  it("keeps unknown +words in the title", () => {
    expect(parseCapture("C++ homework +nope", { ...opts, projects: [] }).title).toBe("C++ homework +nope");
  });

  it("recognizes a type prefix", () => {
    expect(parseCapture("remind: call dentist tomorrow 10am", opts)).toMatchObject({
      kind: "reminder",
      title: "call dentist",
      date: "2026-10-30",
      time: "10:00",
    });
    expect(parseCapture("idea: app for plants", opts).kind).toBe("idea");
  });

  it("can skip date parsing", () => {
    const r = parseCapture("Notes from Monday meeting", { ...opts, parseDates: false });
    expect(r.title).toBe("Notes from Monday meeting");
    expect(r.date).toBeUndefined();
  });
});
