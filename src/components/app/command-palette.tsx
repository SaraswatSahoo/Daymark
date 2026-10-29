"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BookOpen,
  CheckSquare,
  FileText,
  Lightbulb,
  Loader2,
  Moon,
  NotebookPen,
  Search,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useApp } from "./app-context";
import { ALL_NAV } from "./nav";
import { useThemePreference } from "./theme-toggle";
import type { SearchResults } from "@/lib/types";
import { relativeDayLabel, formatInstant } from "@/lib/dates";
import { colorClasses } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";

interface PaletteAction {
  id: string;
  label: string;
  icon: LucideIcon;
  keywords?: string;
  hint?: string;
  run: () => void;
}

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function CommandPalette() {
  const { paletteOpen, setPaletteOpen, openCapture, openTask, openReminder, settings, today } = useApp();
  const router = useRouter();
  const { setTheme, resolvedTheme } = useThemePreference();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 160);
  // Responses are tagged with their query so stale results are never shown.
  const [response, setResponse] = useState<{ query: string; data: SearchResults | null; error: boolean } | null>(null);

  useEffect(() => {
    if (!debounced) return;
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: SearchResults) => setResponse({ query: debounced, data, error: false }))
      .catch((e) => {
        if (e.name !== "AbortError") setResponse({ query: debounced, data: null, error: true });
      });
    return () => controller.abort();
  }, [debounced]);

  const current = response && debounced && response.query === debounced ? response : null;
  const results = query.trim() ? (current?.data ?? null) : null;
  const error = !!current?.error;
  const loading = !!query.trim() && (!current || debounced !== query.trim());

  const setOpen = (open: boolean) => {
    if (!open) setQuery("");
    setPaletteOpen(open);
  };
  const close = () => setOpen(false);
  const go = (href: string) => {
    close();
    router.push(href);
  };

  const actions = useMemo<PaletteAction[]>(
    () => [
      { id: "new-task", label: "Create a task", icon: CheckSquare, keywords: "add todo new", hint: "Q", run: () => openCapture({ kind: "task" }) },
      { id: "new-note", label: "Create a note", icon: NotebookPen, keywords: "add write new", run: () => openCapture({ kind: "note" }) },
      { id: "new-reminder", label: "Create a reminder", icon: Bell, keywords: "alarm alert remind", run: () => { close(); openReminder({}); } },
      { id: "new-idea", label: "Capture an idea to the Inbox", icon: Lightbulb, keywords: "thought inbox brain dump", run: () => openCapture({ kind: "idea" }) },
      { id: "journal", label: "Open today's journal", icon: BookOpen, keywords: "diary daily", run: () => go("/journal") },
      {
        id: "theme",
        label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        icon: resolvedTheme === "dark" ? Sun : Moon,
        keywords: "theme dark light mode appearance",
        run: () => {
          setTheme(resolvedTheme === "dark" ? "light" : "dark");
          close();
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolvedTheme],
  );

  const q = query.trim().toLowerCase();
  const match = (s: string) => !q || s.toLowerCase().includes(q);
  const visibleActions = actions.filter((a) => match(`${a.label} ${a.keywords ?? ""}`));
  const visibleNav = ALL_NAV.concat([{ href: "/settings", label: "Settings", icon: FileText }]).filter((n) =>
    match(`go to open ${n.label}`),
  );
  const hasResults =
    !!results && results.tasks.length + results.notes.length + results.projects.length + results.reminders.length > 0;

  return (
    <Dialog open={paletteOpen} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="top-[max(0.75rem,var(--safe-top))] translate-y-0 gap-0 overflow-hidden p-0 sm:top-[15%] sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Search and commands</DialogTitle>
        <DialogDescription className="sr-only">Search notes, tasks, projects and reminders, or run a command.</DialogDescription>
        <Command shouldFilter={false} loop className="rounded-none bg-transparent">
          <div className="flex items-center gap-2 border-b px-3">
            {loading ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
            ) : (
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <CommandPrimitive.Input
              value={query}
              onValueChange={setQuery}
              placeholder="Search everything or type a command…"
              className="h-12 w-full bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
              aria-label="Search"
            />
          </div>
          <CommandList className="max-h-[min(60dvh,28rem)] p-1">
            {q && !loading && !hasResults && visibleActions.length === 0 && visibleNav.length === 0 && (
              <CommandEmpty className="py-10 text-center text-sm text-muted-foreground">
                {error ? "Search failed. Check your connection." : `No results for “${query.trim()}”.`}
                <button
                  type="button"
                  className="mt-3 block w-full text-brand hover:underline"
                  onClick={() => openCapture({ kind: "task", text: query.trim() })}
                >
                  Create task “{query.trim()}”
                </button>
              </CommandEmpty>
            )}

            {results && results.tasks.length > 0 && (
              <CommandGroup heading="Tasks">
                {results.tasks.map((t) => (
                  <CommandItem key={t.id} value={`task-${t.id}`} onSelect={() => openTask(t.id)} className="items-start">
                    <CheckSquare className={cn("mt-0.5", t.status === "done" && "text-success")} />
                    <div className="min-w-0 flex-1">
                      <p className={cn("truncate", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                      {t.snippet && <p className="truncate text-xs text-muted-foreground">{t.snippet}</p>}
                    </div>
                    {t.dueDate && <span className="text-xs text-muted-foreground">{relativeDayLabel(t.dueDate, today)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results && results.notes.length > 0 && (
              <CommandGroup heading="Notes">
                {results.notes.map((n) => (
                  <CommandItem key={n.id} value={`note-${n.id}`} onSelect={() => go(`/notes/${n.id}`)} className="items-start">
                    <NotebookPen className="mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{n.title}</p>
                      {n.snippet && <p className="line-clamp-1 text-xs text-muted-foreground">{n.snippet}</p>}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results && results.projects.length > 0 && (
              <CommandGroup heading="Projects">
                {results.projects.map((p) => (
                  <CommandItem key={p.id} value={`project-${p.id}`} onSelect={() => go(`/projects/${p.id}`)}>
                    <span className={cn("ml-1 size-2 rounded-full", colorClasses(p.color).dot)} aria-hidden />
                    {p.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {results && results.reminders.length > 0 && (
              <CommandGroup heading="Reminders">
                {results.reminders.map((r) => (
                  <CommandItem key={r.id} value={`reminder-${r.id}`} onSelect={() => { close(); openReminder({ id: r.id }); }}>
                    <Bell />
                    <span className="truncate">{r.title}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatInstant(new Date(r.remindAt), settings.tz, today, settings.timeFormat)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {hasResults && <CommandSeparator />}
            {q && (
              <CommandGroup heading="Search">
                <CommandItem value="search-tasks" onSelect={() => go(`/tasks?q=${encodeURIComponent(query.trim())}&status=all`)}>
                  <Search /> Search all tasks for “{query.trim()}”
                </CommandItem>
                <CommandItem value="search-notes" onSelect={() => go(`/notes?q=${encodeURIComponent(query.trim())}`)}>
                  <Search /> Search all notes for “{query.trim()}”
                </CommandItem>
              </CommandGroup>
            )}
            {visibleActions.length > 0 && (
              <CommandGroup heading="Actions">
                {visibleActions.map((a) => (
                  <CommandItem key={a.id} value={a.id} onSelect={a.run}>
                    <a.icon />
                    {a.label}
                    {a.hint && <span className="ml-auto text-xs text-muted-foreground">{a.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {visibleNav.length > 0 && (
              <CommandGroup heading="Go to">
                {visibleNav.map((n) => (
                  <CommandItem key={n.href} value={`nav-${n.href}`} onSelect={() => go(n.href)}>
                    <n.icon />
                    {n.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {!q && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Tip: search matches titles and content of notes, tasks, projects and reminders.
              </p>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
