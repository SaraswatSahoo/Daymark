"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, List, Loader2, NotebookPen, Pin, Search, X } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { TagChip } from "@/components/common/fields";
import { EmptyState } from "@/components/common/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { colorClasses } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { useStoredValue } from "@/lib/client/use-stored-value";
import type { NoteSummaryDTO } from "@/lib/types";
import { TimeAgo } from "@/components/common/time";

function NoteMeta({ note }: { note: NoteSummaryDTO }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] text-muted-foreground">
      <TimeAgo date={note.updatedAt} />
      {note.project && (
        <span className="inline-flex items-center gap-1">
          <span className={cn("size-1.5 rounded-full", colorClasses(note.project.color).dot)} aria-hidden />
          {note.project.name}
        </span>
      )}
      {note.tags.slice(0, 3).map((t) => (
        <TagChip key={t.id} name={t.name} color={t.color} className="h-4 text-[0.66rem]" />
      ))}
    </span>
  );
}

export function NoteListView({ notes, view }: { notes: NoteSummaryDTO[]; view: "list" | "grid" }) {
  if (view === "grid") {
    return (
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((n) => (
          <li key={n.id}>
            <Link
              href={`/notes/${n.id}`}
              className="flex h-40 flex-col rounded-xl border bg-card p-4 shadow-xs transition-colors hover:border-foreground/20"
            >
              <span className="flex items-start gap-1.5">
                <span className="line-clamp-2 flex-1 font-medium leading-snug">{n.title || "Untitled"}</span>
                {n.pinned && <Pin className="size-3.5 shrink-0 text-brand" aria-label="Pinned" />}
              </span>
              <span className="mt-1.5 line-clamp-3 flex-1 text-sm text-muted-foreground">{n.excerpt || "Empty note"}</span>
              <NoteMeta note={n} />
            </Link>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-border/60">
      {notes.map((n) => (
        <li key={n.id}>
          <Link href={`/notes/${n.id}`} className="flex items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/60">
            <NotebookPen className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[0.92rem] font-medium">{n.title || "Untitled"}</span>
                {n.pinned && <Pin className="size-3 shrink-0 text-brand" aria-label="Pinned" />}
              </span>
              {n.excerpt && <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{n.excerpt}</span>}
              <span className="mt-1 block">
                <NoteMeta note={n} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function NotesBrowser({ pinned, notes, filtered }: { pinned: NoteSummaryDTO[]; notes: NoteSummaryDTO[]; filtered: boolean }) {
  const { projects, tags } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [storedView, changeView] = useStoredValue("daymark:notes-view");
  const view: "list" | "grid" = storedView === "grid" ? "grid" : "list";

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false }));
  };

  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== q.trim()) set("q", q.trim());
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2" role="search">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search titles and content…"
            aria-label="Search notes"
            className="h-8 w-full rounded-lg border border-input bg-transparent pr-8 pl-8 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30"
          />
          {pending && <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
        </div>
        <Select value={params.get("project") ?? "any"} onValueChange={(v) => set("project", v === "any" ? "" : v)}>
          <SelectTrigger size="sm" className="h-8 w-[9.5rem]" aria-label="Project">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">All projects</SelectItem>
            <SelectItem value="none">No project</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {tags.length > 0 && (
          <Select value={params.get("tag") ?? "any"} onValueChange={(v) => set("tag", v === "any" ? "" : v)}>
            <SelectTrigger size="sm" className="h-8 w-[8.5rem]" aria-label="Tag">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any tag</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t.id} value={t.name}>
                  #{t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select value={params.get("sort") ?? "updated"} onValueChange={(v) => set("sort", v === "updated" ? "" : v)}>
          <SelectTrigger size="sm" className="h-8 w-[9rem]" aria-label="Sort">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updated">Recently edited</SelectItem>
            <SelectItem value="created">Newest</SelectItem>
            <SelectItem value="title">Title A–Z</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex rounded-lg border p-0.5" role="radiogroup" aria-label="Layout">
          <button
            type="button"
            role="radio"
            aria-checked={view === "list"}
            aria-label="List view"
            onClick={() => changeView("list")}
            className={cn("rounded-md p-1 text-muted-foreground", view === "list" && "bg-muted text-foreground")}
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === "grid"}
            aria-label="Grid view"
            onClick={() => changeView("grid")}
            className={cn("rounded-md p-1 text-muted-foreground", view === "grid" && "bg-muted text-foreground")}
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); startTransition(() => router.replace(pathname)); }}>
            <X /> Clear
          </Button>
        )}
      </div>

      {pinned.length > 0 && (
        <section className="mb-8" aria-labelledby="pinned-heading">
          <h2 id="pinned-heading" className="mb-2 px-2 text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">
            Pinned
          </h2>
          <NoteListView notes={pinned} view={view} />
        </section>
      )}
      {notes.length > 0 ? (
        <section aria-label="Notes">
          {pinned.length > 0 && (
            <h2 className="mb-2 px-2 text-[0.78rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {filtered ? "Results" : "All notes"}
            </h2>
          )}
          <NoteListView notes={notes} view={view} />
        </section>
      ) : (
        pinned.length === 0 && (
          <EmptyState
            icon={NotebookPen}
            title={filtered ? "No notes match" : "No notes yet"}
            description={filtered ? "Try different words or clear the filters." : "Write your first note — or start from a template like Study Notes or Meeting Notes."}
          />
        )
      )}
    </>
  );
}
