"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, CalendarDays, CheckSquare, FolderKanban, Lightbulb, Loader2, NotebookPen, Sun, X } from "lucide-react";
import { useApp, type CaptureDefaults } from "./app-context";
import { captureAction } from "@/server/actions/capture";
import { parseCapture, type CaptureKind } from "@/lib/capture-parser";
import { addDaysISO, formatTime, relativeDayLabel, timeInTz } from "@/lib/dates";
import { PRIORITY_LABELS, type Priority } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DateInput, ProjectSelect, TagChip, TimeInput } from "@/components/common/fields";

const KINDS: { kind: CaptureKind; label: string; icon: typeof CheckSquare; placeholder: string }[] = [
  { kind: "task", label: "Task", icon: CheckSquare, placeholder: "e.g. Submit lab report fri 5pm #school !high" },
  { kind: "note", label: "Note", icon: NotebookPen, placeholder: "Note title…" },
  { kind: "reminder", label: "Reminder", icon: Bell, placeholder: "e.g. Call the dentist tomorrow 10am" },
  { kind: "idea", label: "Idea", icon: Lightbulb, placeholder: "Anything on your mind — sort it later" },
];

function nextHour(tz: string) {
  const [h] = timeInTz(new Date(), tz).split(":").map(Number);
  return h >= 23 ? "23:30" : `${String(h + 1).padStart(2, "0")}:00`;
}

function CaptureForm({ defaults, onDone }: { defaults: CaptureDefaults; onDone: () => void }) {
  const { settings, today, projects, openTask } = useApp();
  const router = useRouter();
  const [kind, setKind] = useState<CaptureKind>(defaults.kind ?? "task");
  const [text, setText] = useState(defaults.text ?? "");
  const [body, setBody] = useState("");
  const [date, setDate] = useState<string | null>(defaults.date ?? null);
  const [time, setTime] = useState<string | null>(defaults.time ?? null);
  const [projectId, setProjectId] = useState<string | null>(defaults.projectId ?? null);
  const [myDay, setMyDay] = useState(!!defaults.myDay);
  const [ignoreParsedDate, setIgnoreParsedDate] = useState(false);
  const [showDetails, setShowDetails] = useState(!!(defaults.date || defaults.projectId));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const parsed = useMemo(
    () =>
      parseCapture(text, {
        timezone: settings.tz,
        projects,
        parseDates: !ignoreParsedDate && kind !== "note" && kind !== "idea",
      }),
    [text, settings.tz, projects, ignoreParsedDate, kind],
  );
  const effectiveKind = parsed.kind ?? kind;
  const effDate = date ?? parsed.date ?? (effectiveKind === "reminder" ? today : null);
  const effTime = time ?? parsed.time ?? (effectiveKind === "reminder" ? (parsed.date ? settings.defaultReminderTime : nextHour(settings.tz)) : null);
  const effProject = projectId ?? parsed.projectId ?? null;
  const meta = KINDS.find((k) => k.kind === effectiveKind)!;

  const submit = async () => {
    if (saving) return;
    const title = (parsed.title || text).trim();
    if (!title) {
      inputRef.current?.focus();
      toast.error("Type something to capture.");
      return;
    }
    setSaving(true);
    try {
      const res = await captureAction({
        kind: effectiveKind,
        title,
        body: body.trim() || undefined,
        date: effectiveKind === "note" || effectiveKind === "idea" ? null : effDate,
        time: effectiveKind === "note" || effectiveKind === "idea" ? null : effTime,
        tags: parsed.tags,
        priority: parsed.priority,
        projectId: effProject,
        myDay: effectiveKind === "task" ? myDay : undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const r = res.data;
      const where = r.inbox ? "Inbox" : r.kind === "reminder" ? "Reminders" : effProject ? "project" : "list";
      toast.success(`${meta.label} saved${r.inbox ? " to Inbox" : ""}`, {
        description: r.inbox ? undefined : `Added to ${where}.`,
        action:
          r.kind === "task"
            ? { label: "Open", onClick: () => openTask(r.id) }
            : r.kind === "note"
              ? { label: "Open", onClick: () => router.push(`/notes/${r.id}`) }
              : undefined,
      });
      onDone();
    } catch {
      toast.error("Couldn't reach the server. Nothing was saved — your text is still here.");
    } finally {
      setSaving(false);
    }
  };

  const multiline = effectiveKind === "note" || effectiveKind === "idea";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col"
    >
      <div role="tablist" aria-label="Capture type" className="flex gap-1 border-b px-3 pt-3 pb-2">
        {KINDS.map(({ kind: k, label, icon: Icon }) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={effectiveKind === k}
            onClick={() => setKind(k)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[0.8rem] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              effectiveKind === k && "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            <span className={cn(effectiveKind !== k && "max-[380px]:sr-only")}>{label}</span>
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        <label htmlFor="capture-input" className="sr-only">
          {meta.label}
        </label>
        <textarea
          id="capture-input"
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={meta.placeholder}
          className="field-sizing-content max-h-40 min-h-9 w-full resize-none bg-transparent text-[1.05rem] leading-relaxed outline-none placeholder:text-muted-foreground/70"
          maxLength={5000}
          autoComplete="off"
          enterKeyHint="done"
        />
        {multiline && (
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={effectiveKind === "note" ? "Start writing (optional, Markdown supported)…" : "Details (optional)"}
            rows={3}
            className="field-sizing-content mt-1 max-h-60 min-h-16 w-full resize-none bg-transparent text-sm leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground/60"
            aria-label="Details"
          />
        )}

        {(parsed.dateText || parsed.tags.length > 0 || parsed.priority !== undefined || parsed.projectName) && (
          <div className="flex flex-wrap items-center gap-1.5 pb-1 pt-1" aria-live="polite">
            {parsed.dateText && !date && (
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-brand-soft px-2 text-xs font-medium text-brand">
                <CalendarDays className="size-3" aria-hidden />
                {relativeDayLabel(parsed.date!, today)}
                {parsed.time ? ` · ${formatTime(parsed.time, settings.timeFormat)}` : ""}
                <button
                  type="button"
                  onClick={() => setIgnoreParsedDate(true)}
                  className="-mr-1 rounded p-0.5 hover:bg-black/10"
                  aria-label={`Don't treat "${parsed.dateText}" as a date`}
                >
                  <X className="size-3" />
                </button>
              </span>
            )}
            {parsed.projectName && !projectId && (
              <span className="inline-flex h-6 items-center gap-1 rounded-md bg-muted px-2 text-xs font-medium">
                <FolderKanban className="size-3" aria-hidden /> {parsed.projectName}
              </span>
            )}
            {parsed.priority !== undefined && (
              <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs font-medium">
                {PRIORITY_LABELS[parsed.priority as Priority]} priority
              </span>
            )}
            {parsed.tags.map((t) => (
              <TagChip key={t} name={t} className="h-6" />
            ))}
          </div>
        )}
      </div>

      {showDetails && (
        <div className="grid gap-2 px-4 pt-2 pb-1 sm:grid-cols-3">
          {effectiveKind !== "note" && effectiveKind !== "idea" && (
            <>
              <DateInput value={effDate} onChange={setDate} aria-label="Date" />
              <TimeInput value={effTime} onChange={setTime} aria-label="Time" />
            </>
          )}
          {effectiveKind !== "idea" && <ProjectSelect value={effProject} onChange={setProjectId} />}
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t bg-muted/40 px-3 py-2.5">
        {effectiveKind !== "idea" && (
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
            <CalendarDays /> {showDetails ? "Hide options" : "Date & project"}
          </Button>
        )}
        {effectiveKind === "task" && (
          <Button
            type="button"
            variant={myDay ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={myDay}
            onClick={() => setMyDay((v) => !v)}
          >
            <Sun className={cn(myDay && "text-amber-500")} /> My Day
          </Button>
        )}
        {effectiveKind === "task" && !effDate && (
          <Button type="button" variant="ghost" size="sm" onClick={() => { setDate(addDaysISO(today, 1)); setShowDetails(true); }}>
            Tomorrow
          </Button>
        )}
        <p className="ml-auto hidden text-xs text-muted-foreground sm:block">
          {effectiveKind === "idea" || (!effDate && !effProject && !myDay && effectiveKind !== "reminder")
            ? "Saves to Inbox"
            : ""}
        </p>
        <Button type="submit" size="sm" disabled={saving} className="ml-auto sm:ml-0">
          {saving && <Loader2 className="animate-spin" />}
          Save {meta.label.toLowerCase()}
        </Button>
      </div>
    </form>
  );
}

export function QuickCapture() {
  const { captureState, closeCapture } = useApp();
  return (
    <Dialog open={!!captureState} onOpenChange={(open) => !open && closeCapture()}>
      <DialogContent
        showCloseButton={false}
        className="top-[max(0.75rem,var(--safe-top))] translate-y-0 gap-0 overflow-hidden p-0 sm:top-[18%] sm:max-w-xl"
        onOpenAutoFocus={(e) => {
          // Focus the text field synchronously so mobile keyboards open immediately.
          e.preventDefault();
          document.getElementById("capture-input")?.focus();
        }}
      >
        <DialogTitle className="sr-only">Quick capture</DialogTitle>
        <DialogDescription className="sr-only">
          Capture a task, note, reminder or idea. Natural dates, #tags, !priority and +project are recognized.
        </DialogDescription>
        {captureState && <CaptureForm defaults={captureState} onDone={closeCapture} />}
      </DialogContent>
    </Dialog>
  );
}
