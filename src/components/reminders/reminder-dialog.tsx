"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlarmClock, Check, Loader2, Trash2, X } from "lucide-react";
import { useApp, type ReminderDialogState } from "@/components/app/app-context";
import { useConfirm } from "@/components/common/confirm";
import { DateInput, FieldRow, ProjectSelect, RecurrenceSelect, TimeInput } from "@/components/common/fields";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { act } from "@/lib/client/action";
import {
  createReminderAction,
  deleteReminderAction,
  getReminderAction,
  resolveReminderAction,
  snoozeReminderAction,
  updateReminderAction,
} from "@/server/actions/reminders";
import { isoDateInTz, timeInTz, zonedToInstant, formatInstant } from "@/lib/dates";
import { SNOOZE_OPTIONS } from "@/lib/constants";
import type { Recurrence } from "@/lib/recurrence";
import type { ReminderDTO } from "@/lib/types";

function defaultTime(tz: string) {
  const [h] = timeInTz(new Date(), tz).split(":").map(Number);
  return h >= 23 ? "23:30" : `${String(h + 1).padStart(2, "0")}:00`;
}

function ReminderForm({ state, onClose }: { state: ReminderDialogState; onClose: () => void }) {
  const { settings, today } = useApp();
  const confirm = useConfirm();
  const [existing, setExisting] = useState<ReminderDTO | null>(null);
  const [loading, setLoading] = useState(!!state.id);
  const [title, setTitle] = useState(state.title ?? "");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<string | null>(state.date ?? today);
  const [time, setTime] = useState<string | null>(state.time ?? defaultTime(settings.tz));
  const [recurrence, setRecurrence] = useState<Recurrence | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    if (!state.id) return;
    void (async () => {
      const res = await getReminderAction(state.id!);
      if (res.ok) {
        const r = res.data;
        setExisting(r);
        setTitle(r.title);
        setDescription(r.description);
        setDate(isoDateInTz(new Date(r.remindAt), settings.tz));
        setTime(timeInTz(new Date(r.remindAt), settings.tz));
        setRecurrence(r.recurrence);
        setProjectId(r.project?.id ?? null);
      } else setError(res.error);
      setLoading(false);
    })();
  }, [state.id, settings.tz]);

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("Give the reminder a title.");
    if (!date || !time) return setError("Choose a date and time.");
    const remindAt = zonedToInstant(date, time, settings.tz);
    setSaving(true);
    const payload = { title: title.trim(), description, remindAt: remindAt.toISOString(), recurrence, projectId };
    const res = existing
      ? await act(updateReminderAction({ id: existing.id, ...payload }), { success: "Reminder updated" })
      : await act(
          createReminderAction({ ...payload, taskId: state.taskId ?? null, noteId: state.noteId ?? null }),
          {
            success: (r) => `Reminder set for ${formatInstant(new Date(r.remindAt), settings.tz, today, settings.timeFormat)}`,
          },
        );
    setSaving(false);
    if (res) onClose();
  };

  if (loading) {
    return (
      <div className="space-y-3 py-2" aria-busy="true">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }

  const isPast = date && time ? zonedToInstant(date, time, settings.tz).getTime() < openedAt : false;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      {existing && existing.status !== "pending" && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          This reminder was {existing.status === "done" ? "completed" : "dismissed"}. Changing the time re-schedules it.
        </p>
      )}
      <div className="space-y-1.5">
        <label htmlFor="reminder-title" className="text-sm font-medium">
          Remind me to…
        </label>
        <Input id="reminder-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={300} autoFocus={!existing} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label htmlFor="reminder-date" className="text-sm font-medium">
            Date
          </label>
          <DateInput id="reminder-date" value={date} onChange={setDate} />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="reminder-time" className="text-sm font-medium">
            Time
          </label>
          <TimeInput id="reminder-time" value={time} onChange={setTime} />
        </div>
      </div>
      {isPast && !existing && <p className="text-xs text-warning">That time has passed — the reminder will be due immediately.</p>}
      <FieldRow label="Repeat" htmlFor="reminder-repeat">
        <RecurrenceSelect id="reminder-repeat" value={recurrence} onChange={setRecurrence} />
      </FieldRow>
      <FieldRow label="Project" htmlFor="reminder-project">
        <ProjectSelect id="reminder-project" value={projectId} onChange={setProjectId} />
      </FieldRow>
      <div className="space-y-1.5">
        <label htmlFor="reminder-notes" className="text-sm font-medium">
          Notes <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea id="reminder-notes" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={5000} />
      </div>
      {existing?.task && (
        <p className="text-xs text-muted-foreground">
          For task: <span className="font-medium text-foreground">{existing.task.title}</span>
        </p>
      )}
      {existing?.note && (
        <p className="text-xs text-muted-foreground">
          For note:{" "}
          <Link href={`/notes/${existing.note.id}`} className="font-medium text-foreground hover:underline" onClick={onClose}>
            {existing.note.title || "Untitled"}
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {existing && existing.status === "pending" && (
        <div className="flex flex-wrap gap-1.5 border-t pt-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={async () => {
              const r = await act(resolveReminderAction(existing.id, "done"), { success: "Reminder completed" });
              if (r) onClose();
            }}
          >
            <Check /> Done
          </Button>
          {SNOOZE_OPTIONS.slice(0, 3).map((o) => (
            <Button
              key={o.minutes}
              type="button"
              size="sm"
              variant="ghost"
              onClick={async () => {
                const r = await act(snoozeReminderAction(existing.id, o.minutes), { success: `Snoozed ${o.label}` });
                if (r) onClose();
              }}
            >
              <AlarmClock /> {o.label}
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={async () => {
              const r = await act(resolveReminderAction(existing.id, "dismissed"), { success: "Reminder dismissed" });
              if (r) onClose();
            }}
          >
            <X /> Dismiss
          </Button>
        </div>
      )}

      <DialogFooter className="gap-2 sm:justify-between">
        {existing ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              if (await confirm({ title: "Delete this reminder?", confirmLabel: "Delete", destructive: true })) {
                const r = await act(deleteReminderAction(existing.id), { success: "Reminder deleted" });
                if (r !== undefined) onClose();
              }
            }}
          >
            <Trash2 /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />}
            {existing ? "Save" : "Set reminder"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

export function ReminderDialog() {
  const { reminderState, closeReminder } = useApp();
  return (
    <Dialog open={!!reminderState} onOpenChange={(open) => !open && closeReminder()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{reminderState?.id ? "Reminder" : "New reminder"}</DialogTitle>
          <DialogDescription>
            Reminders notify you in the app and, when permitted, through system notifications.
          </DialogDescription>
        </DialogHeader>
        {reminderState && <ReminderForm key={reminderState.id ?? "new"} state={reminderState} onClose={closeReminder} />}
      </DialogContent>
    </Dialog>
  );
}
