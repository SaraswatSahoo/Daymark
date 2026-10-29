"use client";

import { useMemo, useState } from "react";
import { Bell, CornerDownLeft, Lightbulb, Loader2, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { captureAction } from "@/server/actions/capture";
import { parseCapture } from "@/lib/capture-parser";
import { relativeDayLabel } from "@/lib/dates";
import { Button } from "@/components/ui/button";

/** Inline capture on the dashboard: Enter saves a task (to the Inbox unless a date/project is given). */
export function DashboardCapture() {
  const { settings, projects, today, openCapture, openTask } = useApp();
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const parsed = useMemo(
    () => (value.trim() ? parseCapture(value, { timezone: settings.tz, projects }) : null),
    [value, settings.tz, projects],
  );

  const save = async () => {
    if (!parsed?.title || saving) return;
    setSaving(true);
    try {
      const res = await captureAction({
        kind: parsed.kind ?? "task",
        title: parsed.title,
        date: parsed.date ?? (parsed.kind === "reminder" ? today : null),
        time: parsed.time ?? null,
        tags: parsed.tags,
        priority: parsed.priority,
        projectId: parsed.projectId ?? null,
      });
      if (!res.ok) return void toast.error(res.error);
      setValue("");
      toast.success(res.data.inbox ? "Captured to Inbox" : "Saved", {
        action: res.data.kind === "task" ? { label: "Open", onClick: () => openTask(res.data.id) } : undefined,
      });
    } catch {
      toast.error("Couldn't reach the server. Nothing was saved.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card shadow-xs focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex items-center gap-2 px-3"
      >
        <label htmlFor="dash-capture" className="sr-only">
          Capture a task or thought
        </label>
        <input
          id="dash-capture"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Capture a task — try “Email advisor tomorrow 9am #thesis”"
          className="h-12 min-w-0 flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
          maxLength={300}
          autoComplete="off"
          enterKeyHint="done"
        />
        {parsed?.date && (
          <span className="hidden shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-xs font-medium text-brand sm:inline">
            {relativeDayLabel(parsed.date, today)}
            {parsed.time ? ` ${parsed.time}` : ""}
          </span>
        )}
        <Button type="submit" size="icon-sm" variant="ghost" disabled={!value.trim() || saving} aria-label="Save as task">
          {saving ? <Loader2 className="animate-spin" /> : <CornerDownLeft />}
        </Button>
      </form>
      <div className="flex flex-wrap items-center gap-1 border-t px-2 py-1.5">
        <span className="hidden px-1 text-xs text-muted-foreground sm:inline">Enter saves a task ·</span>
        <Button variant="ghost" size="xs" onClick={() => openCapture({ kind: "note", text: value })}>
          <NotebookPen /> Note
        </Button>
        <Button variant="ghost" size="xs" onClick={() => openCapture({ kind: "reminder", text: value })}>
          <Bell /> Reminder
        </Button>
        <Button variant="ghost" size="xs" onClick={() => openCapture({ kind: "idea", text: value })}>
          <Lightbulb /> Idea
        </Button>
      </div>
    </div>
  );
}
