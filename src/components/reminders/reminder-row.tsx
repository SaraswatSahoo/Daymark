"use client";

import { AlarmClock, Bell, BellRing, Check, MoreHorizontal, Repeat, Trash2, X } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { useConfirm } from "@/components/common/confirm";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { act } from "@/lib/client/action";
import { deleteReminderAction, resolveReminderAction, snoozeReminderAction } from "@/server/actions/reminders";
import { formatInstant } from "@/lib/dates";
import { describeRecurrence } from "@/lib/recurrence";
import { SNOOZE_OPTIONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ReminderDTO } from "@/lib/types";

export function reminderState(r: ReminderDTO): "upcoming" | "due" | "done" | "dismissed" {
  if (r.status === "done") return "done";
  if (r.status === "dismissed") return "dismissed";
  return new Date(r.remindAt).getTime() <= Date.now() ? "due" : "upcoming";
}

export function ReminderRow({ reminder: r, compact }: { reminder: ReminderDTO; compact?: boolean }) {
  const { settings, today, openReminder, openTask } = useApp();
  const confirm = useConfirm();
  const state = reminderState(r);
  const Icon = state === "due" ? BellRing : Bell;

  return (
    <li className="group flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/60">
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          state === "due" ? "text-warning" : state === "upcoming" ? "text-brand" : "text-muted-foreground",
        )}
        aria-hidden
      />
      <button type="button" onClick={() => openReminder({ id: r.id })} className="min-w-0 flex-1 text-left">
        <span className={cn("block break-words text-[0.9rem] leading-snug", state === "done" && "text-muted-foreground line-through")}>
          {r.title}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.74rem] text-muted-foreground">
          <span className={cn(state === "due" && "font-medium text-warning")}>
            {state === "due" ? "Due · " : ""}
            {formatInstant(new Date(r.remindAt), settings.tz, today, settings.timeFormat)}
          </span>
          {r.recurrence && (
            <span className="inline-flex items-center gap-1">
              <Repeat className="size-3" aria-hidden /> {describeRecurrence(r.recurrence)}
            </span>
          )}
          {r.snoozeCount > 0 && !compact && <span>Snoozed {r.snoozeCount}×</span>}
          {state === "dismissed" && <span>Dismissed</span>}
          {!compact && r.task && <span className="truncate">Task: {r.task.title}</span>}
          {!compact && r.note && <span className="truncate">Note: {r.note.title || "Untitled"}</span>}
        </span>
      </button>
      {(state === "due" || state === "upcoming") && (
        <div className="flex shrink-0 items-center gap-0.5">
          {state === "due" && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Mark "${r.title}" done`}
              onClick={() => void act(resolveReminderAction(r.id, "done"), { success: "Reminder completed" })}
            >
              <Check />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for reminder ${r.title}`}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => void act(resolveReminderAction(r.id, "done"), { success: "Reminder completed" })}>
                <Check /> Mark done
              </DropdownMenuItem>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Snooze</DropdownMenuLabel>
              {SNOOZE_OPTIONS.map((o) => (
                <DropdownMenuItem
                  key={o.minutes}
                  onSelect={() => void act(snoozeReminderAction(r.id, o.minutes), { success: `Snoozed · ${o.label}` })}
                >
                  <AlarmClock /> {o.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => openReminder({ id: r.id })}>Edit / reschedule</DropdownMenuItem>
              {r.task && <DropdownMenuItem onSelect={() => openTask(r.task!.id)}>Open task</DropdownMenuItem>}
              <DropdownMenuItem onSelect={() => void act(resolveReminderAction(r.id, "dismissed"), { success: "Dismissed" })}>
                <X /> Dismiss
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={async () => {
                  if (await confirm({ title: "Delete this reminder?", confirmLabel: "Delete", destructive: true }))
                    void act(deleteReminderAction(r.id), { success: "Reminder deleted" });
                }}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}
