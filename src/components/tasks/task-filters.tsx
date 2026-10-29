"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, X } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PRIORITY_LABELS, type Priority } from "@/lib/constants";

const STATUS_OPTIONS = [
  ["open", "Open"],
  ["todo", "To do"],
  ["in_progress", "In progress"],
  ["done", "Completed"],
  ["all", "All"],
] as const;
const DUE_OPTIONS = [
  ["any", "Any date"],
  ["overdue", "Overdue"],
  ["today", "Due today"],
  ["week", "This week"],
  ["scheduled", "Has a date"],
  ["none", "No date"],
] as const;
const SORT_OPTIONS = [
  ["smart", "Smart order"],
  ["due", "Due date"],
  ["priority", "Priority"],
  ["created", "Newest"],
  ["updated", "Recently updated"],
  ["title", "Title"],
  ["manual", "Manual"],
] as const;
const GROUP_OPTIONS = [
  ["none", "No grouping"],
  ["project", "By project"],
  ["priority", "By priority"],
  ["status", "By status"],
  ["due", "By due date"],
] as const;

function FilterSelect({
  label,
  param,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  param: string;
  value: string;
  options: readonly (readonly [string, string])[];
  onChange: (param: string, value: string) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(param, v)}>
      <SelectTrigger size="sm" className={cn("h-8 min-w-0", className)} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** URL-driven filters so every filtered view is linkable and survives reloads. */
export function TaskFilters({ defaults }: { defaults: Record<string, string> }) {
  const { projects, tags } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  const get = (key: string) => params.get(key) ?? defaults[key] ?? "";
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || value === defaults[key]) next.delete(key);
    else next.set(key, value);
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set("q", q.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const active = ["status", "priority", "project", "tag", "due", "q"].some(
    (k) => params.has(k) && params.get(k) !== defaults[k],
  );

  return (
    <div className="mb-5 space-y-2" role="search" aria-label="Filter tasks">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by title or notes…"
            aria-label="Filter tasks by text"
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-8 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30"
          />
          {pending && <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-label="Loading" />}
        </div>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              startTransition(() => router.replace(pathname, { scroll: false }));
            }}
          >
            <X /> Clear
          </Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <FilterSelect label="Status" param="status" value={get("status")} options={STATUS_OPTIONS} onChange={set} />
        <FilterSelect label="Due" param="due" value={get("due")} options={DUE_OPTIONS} onChange={set} />
        <FilterSelect
          label="Priority"
          param="priority"
          value={get("priority") || "any"}
          options={[["any", "Any priority"], ...[3, 2, 1, 0].map((p) => [String(p), PRIORITY_LABELS[p as Priority]] as const)]}
          onChange={(k, v) => set(k, v === "any" ? "" : v)}
        />
        <FilterSelect
          label="Project"
          param="project"
          value={get("project") || "any"}
          options={[["any", "All projects"], ["none", "No project"], ...projects.map((p) => [p.id, p.name] as const)]}
          onChange={(k, v) => set(k, v === "any" ? "" : v)}
        />
        {tags.length > 0 && (
          <FilterSelect
            label="Tag"
            param="tag"
            value={get("tag") || "any"}
            options={[["any", "Any tag"], ...tags.map((t) => [t.name, `#${t.name}`] as const)]}
            onChange={(k, v) => set(k, v === "any" ? "" : v)}
          />
        )}
        <FilterSelect label="Sort" param="sort" value={get("sort")} options={SORT_OPTIONS} onChange={set} />
        <FilterSelect label="Group" param="group" value={get("group")} options={GROUP_OPTIONS} onChange={set} />
      </div>
    </div>
  );
}
