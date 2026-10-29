"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Flag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorClasses, PRIORITY_STYLES } from "@/lib/colors";
import { PRIORITY_LABELS, type Priority } from "@/lib/constants";
import { RECURRENCE_FREQS, type Recurrence } from "@/lib/recurrence";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/components/app/app-context";

export const fieldInputClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 dark:bg-input/30 [color-scheme:light] dark:[color-scheme:dark]";

export function DateInput({
  value,
  onChange,
  className,
  ...rest
}: { value: string | null | undefined; onChange: (v: string | null) => void; className?: string } & Omit<
  React.ComponentProps<"input">,
  "value" | "onChange"
>) {
  return (
    <input
      type="date"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(fieldInputClass, className)}
      {...rest}
    />
  );
}

export function TimeInput({
  value,
  onChange,
  className,
  ...rest
}: { value: string | null | undefined; onChange: (v: string | null) => void; className?: string } & Omit<
  React.ComponentProps<"input">,
  "value" | "onChange"
>) {
  return (
    <input
      type="time"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(fieldInputClass, className)}
      {...rest}
    />
  );
}

export function ProjectSelect({
  value,
  onChange,
  className,
  id,
  placeholder = "No project",
}: {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  className?: string;
  id?: string;
  placeholder?: string;
}) {
  const { projects } = useApp();
  return (
    <Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
      <SelectTrigger id={id} className={cn("w-full min-w-0", className)} aria-label="Project">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">
          <span className="text-muted-foreground">{placeholder}</span>
        </SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            <span className={cn("size-2 rounded-full", colorClasses(p.color).dot)} aria-hidden />
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PriorityFlag({ priority, className }: { priority: number; className?: string }) {
  if (priority < 2) return null;
  return (
    <Flag
      className={cn("size-3.5 shrink-0 fill-current", PRIORITY_STYLES[priority]?.flag, className)}
      aria-label={`${PRIORITY_LABELS[priority as Priority]} priority`}
    />
  );
}

export function PrioritySelect({
  value,
  onChange,
  className,
  id,
}: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  id?: string;
}) {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger id={id} className={cn("w-full min-w-0", className)} aria-label="Priority">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {[3, 2, 1, 0].map((p) => (
          <SelectItem key={p} value={String(p)}>
            <Flag className={cn("size-3.5", PRIORITY_STYLES[p].flag, p >= 2 && "fill-current")} aria-hidden />
            {PRIORITY_LABELS[p as Priority]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const FREQ_LABEL: Record<string, string> = {
  daily: "day(s)",
  weekdays: "weekdays",
  weekly: "week(s)",
  monthly: "month(s)",
  yearly: "year(s)",
};

export function RecurrenceSelect({
  value,
  onChange,
  id,
}: {
  value: Recurrence | null;
  onChange: (v: Recurrence | null) => void;
  id?: string;
}) {
  const intervalId = useId();
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Select
        value={value?.freq ?? "none"}
        onValueChange={(v) => onChange(v === "none" ? null : { freq: v as Recurrence["freq"], interval: value?.interval ?? 1 })}
      >
        <SelectTrigger id={id} className="min-w-0 flex-1" aria-label="Repeat">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Does not repeat</SelectItem>
          {RECURRENCE_FREQS.map((f) => (
            <SelectItem key={f} value={f}>
              {f === "weekdays" ? "Every weekday (Mon–Fri)" : `Every ${FREQ_LABEL[f]}`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && value.freq !== "weekdays" && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <label htmlFor={intervalId} className="sr-only">
            Repeat interval
          </label>
          <span aria-hidden>every</span>
          <input
            id={intervalId}
            type="number"
            min={1}
            max={365}
            value={value.interval}
            onChange={(e) =>
              onChange({ ...value, interval: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })
            }
            className={cn(fieldInputClass, "w-16")}
          />
        </div>
      )}
    </div>
  );
}

export function TagChip({
  name,
  color,
  onRemove,
  className,
}: {
  name: string;
  color?: string;
  onRemove?: () => void;
  className?: string;
}) {
  const c = colorClasses(color);
  return (
    <span
      className={cn(
        "inline-flex h-5 max-w-[12rem] items-center gap-1 rounded-md px-1.5 text-[0.72rem] font-medium",
        c.soft,
        c.text,
        className,
      )}
    >
      <span className="truncate">#{name}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} className="-mr-0.5 rounded hover:bg-black/10" aria-label={`Remove tag ${name}`}>
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** Tag editor: type and press Enter or comma; suggestions come from existing tags. */
export function TagInput({
  value,
  onChange,
  id,
  className,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string;
  className?: string;
}) {
  const { tags: allTags } = useApp();
  const [draft, setDraft] = useState("");
  const listId = useId();
  const add = (raw: string) => {
    const name = raw.trim().replace(/^#/, "").toLowerCase().slice(0, 40);
    if (name && !value.includes(name)) onChange([...value, name]);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (draft.trim()) add(draft);
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };
  const colorOf = (name: string) => allTags.find((t) => t.name === name)?.color;
  return (
    <div
      className={cn(
        "flex min-h-8 w-full min-w-0 flex-wrap items-center gap-1 rounded-lg border border-input px-1.5 py-1 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 dark:bg-input/30",
        className,
      )}
    >
      {value.map((t) => (
        <TagChip key={t} name={t} color={colorOf(t)} onRemove={() => onChange(value.filter((x) => x !== t))} />
      ))}
      <input
        id={id}
        value={draft}
        list={listId}
        onChange={(e) => {
          const v = e.target.value;
          if (v.endsWith(",")) add(v.slice(0, -1));
          else setDraft(v);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && add(draft)}
        placeholder={value.length ? "" : "Add tags…"}
        className="h-6 min-w-[6rem] flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        aria-label="Add tag"
      />
      <datalist id={listId}>
        {allTags
          .filter((t) => !value.includes(t.name))
          .map((t) => (
            <option key={t.id} value={t.name} />
          ))}
      </datalist>
    </div>
  );
}

export function FieldRow({ label, htmlFor, children, className }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[0.8rem] text-muted-foreground">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
