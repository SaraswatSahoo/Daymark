"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bold,
  Check,
  CheckSquare,
  CircleAlert,
  Code,
  Copy,
  Download,
  Eye,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  MoreHorizontal,
  PanelRight,
  Pencil,
  Pin,
  PinOff,
  Quote,
  SquareSplitHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/common/confirm";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MarkdownPreview, toggleChecklistLine } from "./markdown-preview";
import { NoteDetails } from "./note-details";
import { NoteAiMenu } from "./note-ai";
import { clearDraft, readDraft, useNoteAutosave, type SaveState } from "./use-autosave";
import { continueList, insertText, prefixLines, wrapSelection, type EditResult } from "./editor-commands";
import { act } from "@/lib/client/action";
import { useStoredValue } from "@/lib/client/use-stored-value";
import { useMounted } from "@/components/app/theme-toggle";
import { archiveNoteAction, deleteNoteAction, duplicateNoteAction, updateNoteAction } from "@/server/actions/notes";
import { createTaskAction } from "@/server/actions/tasks";
import { cn } from "@/lib/utils";
import type { NoteDetailDTO } from "@/lib/types";
import { TimeAgo } from "@/components/common/time";

type Mode = "write" | "preview" | "split";

function SaveIndicator({ state, lastSavedAt, onRetry }: { state: SaveState; lastSavedAt: string; onRetry: () => void }) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (state === "error")
    return (
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-xs text-destructive hover:underline" role="status">
        <CircleAlert className="size-3.5" /> Not saved — retry
      </button>
    );
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status" aria-live="polite">
      {state === "saving" ? (
        <>
          <Loader2 className="size-3 animate-spin" /> Saving…
        </>
      ) : state === "dirty" ? (
        "Unsaved changes"
      ) : state === "conflict" ? (
        <span className="text-warning">Edited elsewhere</span>
      ) : (
        <>
          <Check className="size-3" /> Saved <TimeAgo date={lastSavedAt} />
        </>
      )}
    </span>
  );
}

const TOOLBAR = [
  { id: "bold", label: "Bold (Ctrl+B)", icon: Bold },
  { id: "italic", label: "Italic (Ctrl+I)", icon: Italic },
  { id: "heading", label: "Heading", icon: Heading2 },
  { id: "bullet", label: "Bulleted list", icon: List },
  { id: "number", label: "Numbered list", icon: ListOrdered },
  { id: "check", label: "Checklist", icon: CheckSquare },
  { id: "quote", label: "Quote", icon: Quote },
  { id: "code", label: "Code", icon: Code },
  { id: "link", label: "Link (Ctrl+K in editor)", icon: Link2 },
] as const;

export function NoteEditor({ note }: { note: NoteDetailDTO }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [modeChoice, setModeChoice] = useState<Mode | null>(null);
  const [storedMode, storeMode] = useStoredValue("daymark:editor-mode");
  const mode: Mode = modeChoice ?? (storedMode === "split" && note.content.trim() ? "split" : note.content.trim() ? "preview" : "write");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [draftHandled, setDraftHandled] = useState(false);
  const mounted = useMounted();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autosave = useNoteAutosave(note.id, { title: note.title, content: note.content, updatedAt: note.updatedAt });

  // Offer to restore a local draft that never reached the server (e.g. offline, crash).
  // Read once after mount; autosave keeps rewriting the draft while typing.
  const initialDraft = useMemo(() => {
    if (!mounted) return null;
    const d = readDraft(note.id);
    if (!d || (d.content === note.content && d.title === note.title)) return null;
    return d.savedAt > new Date(note.updatedAt).getTime() - 5_000 ? d : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, note.id]);
  const draft = draftHandled ? null : initialDraft;

  const changeMode = (m: Mode) => {
    setModeChoice(m);
    storeMode(m);
    if (m !== "preview") setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const setContentAndSave = (value: string) => {
    setContent(value);
    autosave.update({ content: value });
  };
  const setTitleAndSave = (value: string) => {
    setTitle(value);
    autosave.update({ title: value });
  };

  const apply = (r: EditResult) => {
    setContentAndSave(r.value);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(r.selectionStart, r.selectionEnd);
    });
  };

  const command = (id: (typeof TOOLBAR)[number]["id"]) => {
    if (mode === "preview") changeMode("write");
    const ta = textareaRef.current;
    const s = ta?.selectionStart ?? content.length;
    const e = ta?.selectionEnd ?? content.length;
    switch (id) {
      case "bold":
        return apply(wrapSelection(content, s, e, "**"));
      case "italic":
        return apply(wrapSelection(content, s, e, "_"));
      case "code":
        return apply(content.slice(s, e).includes("\n") ? wrapSelection(content, s, e, "```\n", "\n```", "code") : wrapSelection(content, s, e, "`"));
      case "heading":
        return apply(prefixLines(content, s, e, "## "));
      case "bullet":
        return apply(prefixLines(content, s, e, "- "));
      case "number":
        return apply(prefixLines(content, s, e, (i) => `${i + 1}. `));
      case "check":
        return apply(prefixLines(content, s, e, "- [ ] "));
      case "quote":
        return apply(prefixLines(content, s, e, "> "));
      case "link": {
        const sel = content.slice(s, e);
        if (/^https?:\/\//.test(sel)) return apply(insertText(content, s, e, `[link](${sel})`));
        return apply(wrapSelection(content, s, e, "[", "](https://)", "link text"));
      }
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "b") {
      e.preventDefault();
      command("bold");
    } else if (mod && e.key.toLowerCase() === "i") {
      e.preventDefault();
      command("italic");
    } else if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      void autosave.saveNow();
    } else if (e.key === "Enter" && !e.shiftKey && !mod && !e.nativeEvent.isComposing) {
      const ta = e.currentTarget;
      if (ta.selectionStart === ta.selectionEnd) {
        const r = continueList(content, ta.selectionStart);
        if (r) {
          e.preventDefault();
          apply(r);
        }
      }
    } else if (e.key === "Tab" && !mod) {
      e.preventDefault();
      const ta = e.currentTarget;
      apply(e.shiftKey ? prefixLines(content, ta.selectionStart, ta.selectionEnd, "  ") : insertText(content, ta.selectionStart, ta.selectionEnd, "  "));
    }
  };

  const getSelection = () => {
    const ta = textareaRef.current;
    if (!ta || mode === "preview") return { text: "", start: 0, end: 0 };
    return { text: content.slice(ta.selectionStart, ta.selectionEnd), start: ta.selectionStart, end: ta.selectionEnd };
  };

  const taskFromSelection = async () => {
    const sel = getSelection().text.trim();
    const line = sel || (() => {
      const ta = textareaRef.current;
      if (!ta) return "";
      const start = content.lastIndexOf("\n", ta.selectionStart - 1) + 1;
      const end = content.indexOf("\n", ta.selectionStart);
      return content.slice(start, end === -1 ? undefined : end).replace(/^\s*([-*+]\s(\[[ xX]\]\s)?|\d+\.\s|#+\s)/, "").trim();
    })();
    if (!line) return toast.error("Select some text (or place the cursor on a line) in the editor first.");
    const [first, ...rest] = line.split("\n");
    await act(
      createTaskAction({
        title: first.slice(0, 300),
        description: rest.join("\n").trim(),
        noteId: note.id,
        projectId: note.project?.id ?? null,
      }),
      { success: (t) => `Task created: ${t.title}` },
    );
  };

  const resolveConflict = async (choice: "mine" | "theirs") => {
    const theirs = await autosave.resolveConflict(choice);
    if (theirs) {
      setTitle(theirs.title);
      setContent(theirs.content);
      toast.success("Loaded the latest version");
    } else toast.success("Your version was saved");
  };

  const details = <NoteDetails note={note} onTaskFromSelection={taskFromSelection} />;

  const words = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 pt-4 sm:px-6 lg:pt-6">
      <article className="min-w-0 flex-1">
        <div className="sticky top-12 z-20 -mx-2 mb-3 flex flex-wrap items-center gap-1 bg-background/90 px-2 py-1.5 backdrop-blur md:top-0">
          <Button asChild variant="ghost" size="icon-sm" aria-label="Back to notes">
            <Link href={note.journalDate ? "/journal" : "/notes"}>
              <ArrowLeft />
            </Link>
          </Button>
          <SaveIndicator state={autosave.state} lastSavedAt={autosave.lastSavedAt} onRetry={() => void autosave.saveNow()} />
          <div className="ml-auto flex items-center gap-0.5">
            <div role="radiogroup" aria-label="Editor mode" className="flex rounded-lg border p-0.5">
              {(
                [
                  ["write", "Write", Pencil],
                  ["split", "Split", SquareSplitHorizontal],
                  ["preview", "Preview", Eye],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  onClick={() => changeMode(m)}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:text-foreground",
                    mode === m && "bg-muted font-medium text-foreground",
                    m === "split" && "hidden lg:flex",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <NoteAiMenu
              noteId={note.id}
              projectId={note.project?.id ?? null}
              title={title}
              getContent={() => content}
              getSelection={getSelection}
              onInsert={(text, where) => setContentAndSave(where === "top" ? text + content : content + text)}
              onReplaceSelection={(text, r) => setContentAndSave(content.slice(0, r.start) + text + content.slice(r.end))}
              onSetTitle={setTitleAndSave}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={note.pinned ? "Unpin note" : "Pin note"}
              aria-pressed={note.pinned}
              onClick={() => void act(updateNoteAction({ id: note.id, pinned: !note.pinned }), { success: note.pinned ? "Unpinned" : "Pinned" })}
            >
              {note.pinned ? <PinOff /> : <Pin />}
            </Button>
            <Button variant="ghost" size="icon-sm" className="xl:hidden" onClick={() => setDetailsOpen(true)} aria-label="Note details">
              <PanelRight />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label="More note actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={taskFromSelection}>
                  <CheckSquare /> Create task from selection
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={async () => {
                    const id = await act(duplicateNoteAction(note.id), { success: "Note duplicated" });
                    if (id) router.push(`/notes/${id}`);
                  }}
                >
                  <Copy /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    const blob = new Blob([`# ${title || "Untitled"}\n\n${content}\n`], { type: "text/markdown" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${(title || "note").replace(/[\\/:*?"<>|]/g, "-").slice(0, 80)}.md`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }}
                >
                  <Download /> Export as Markdown
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {note.archivedAt ? (
                  <DropdownMenuItem onSelect={() => void act(archiveNoteAction(note.id, false), { success: "Note restored" })}>
                    <ArchiveRestore /> Restore from archive
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    onSelect={async () => {
                      await autosave.saveNow();
                      const r = await act(archiveNoteAction(note.id, true), { success: "Note archived" });
                      if (r !== undefined) router.push("/notes");
                    }}
                  >
                    <Archive /> Archive
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={async () => {
                    if (
                      await confirm({
                        title: "Delete this note permanently?",
                        description: "This can't be undone. Linked tasks are kept. Consider archiving instead.",
                        confirmLabel: "Delete note",
                        destructive: true,
                      })
                    ) {
                      const r = await act(deleteNoteAction(note.id), { success: "Note deleted" });
                      if (r !== undefined) {
                        clearDraft(note.id);
                        router.push("/notes");
                      }
                    }
                  }}
                >
                  <Trash2 /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {draft && (
          <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <span className="flex-1">
              Found unsaved changes from <TimeAgo date={new Date(draft.savedAt)} /> on this device.
            </span>
            <Button
              size="sm"
              onClick={() => {
                setTitle(draft.title);
                setContent(draft.content);
                autosave.update({ title: draft.title, content: draft.content });
                setDraftHandled(true);
              }}
            >
              Restore
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { clearDraft(note.id); setDraftHandled(true); }}>
              Discard
            </Button>
          </div>
        )}

        {autosave.conflict && (
          <div role="alert" className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
            <p className="font-medium">This note was changed in another tab or device.</p>
            <p className="text-muted-foreground">Your edits are kept locally. Choose which version to keep.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => resolveConflict("mine")}>
                Keep my version
              </Button>
              <Button size="sm" variant="outline" onClick={() => resolveConflict("theirs")}>
                Load the other version
              </Button>
            </div>
          </div>
        )}

        {note.archivedAt && (
          <p className="mb-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">This note is archived.</p>
        )}

        <label htmlFor="note-title" className="sr-only">
          Title
        </label>
        <textarea
          id="note-title"
          value={title}
          rows={1}
          maxLength={300}
          placeholder="Untitled"
          onChange={(e) => setTitleAndSave(e.target.value.replace(/\n/g, " "))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              changeMode(mode === "preview" ? "write" : mode);
              textareaRef.current?.focus();
            }
          }}
          className="field-sizing-content w-full resize-none bg-transparent font-display text-3xl leading-tight font-semibold tracking-tight outline-none placeholder:text-muted-foreground/50 sm:text-[2.1rem]"
        />
        {(note.project || note.tags.length > 0) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {note.project && <Link href={`/projects/${note.project.id}`} className="hover:underline">{note.project.name}</Link>}
            {note.tags.map((t) => (
              <span key={t.id} className="ml-2">
                #{t.name}
              </span>
            ))}
          </p>
        )}

        {mode !== "preview" && (
          <div className="mt-4 flex flex-wrap gap-0.5 border-y py-1" role="toolbar" aria-label="Formatting">
            {TOOLBAR.map((t) => (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onMouseDown={(e) => e.preventDefault()} onClick={() => command(t.id)} aria-label={t.label}>
                    <t.icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t.label}</TooltipContent>
              </Tooltip>
            ))}
            <span className="ml-auto self-center pr-1 text-[0.7rem] text-muted-foreground tabular-nums">{words} words</span>
          </div>
        )}

        <div className={cn("mt-4", mode === "split" && "grid gap-6 lg:grid-cols-2")}>
          {mode !== "preview" && (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContentAndSave(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={"Start writing… Markdown works: # heading, - list, - [ ] checklist, **bold**, [[Another note]]"}
              aria-label="Note content"
              spellCheck
              className="field-sizing-content min-h-[50dvh] w-full resize-none bg-transparent font-mono text-[0.9rem] leading-7 outline-none placeholder:text-muted-foreground/60"
            />
          )}
          {mode !== "write" && (
            <div className={cn("min-h-[30dvh]", mode === "split" && "border-t pt-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6")}>
              {content.trim() ? (
                <MarkdownPreview content={content} onToggleCheckbox={(line) => setContentAndSave(toggleChecklistLine(content, line))} />
              ) : (
                <button type="button" onClick={() => changeMode("write")} className="text-muted-foreground hover:text-foreground">
                  Nothing here yet — click to start writing.
                </button>
              )}
            </div>
          )}
        </div>
      </article>

      <aside className="hidden w-72 shrink-0 pt-14 xl:block" aria-label="Note details">
        {details}
      </aside>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto data-[side=right]:sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Details</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{details}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
