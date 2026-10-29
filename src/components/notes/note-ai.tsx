"use client";

import { useState } from "react";
import { Copy, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DateInput, fieldInputClass } from "@/components/common/fields";
import { MarkdownPreview } from "./markdown-preview";
import { useAi } from "@/lib/client/use-ai";
import { act } from "@/lib/client/action";
import { createTaskAction } from "@/server/actions/tasks";
import { AI_LIMITS, type ExtractedTask } from "@/lib/ai-schemas";
import { cn } from "@/lib/utils";

const PRIORITY_MAP = { low: 0, medium: 1, high: 2, urgent: 3 } as const;

type Result =
  | { kind: "summary"; text: string }
  | { kind: "tasks"; tasks: (ExtractedTask & { keep: boolean })[] }
  | { kind: "title"; title: string }
  | { kind: "rewrite"; text: string; original: string; mode: string };

interface NoteAiProps {
  noteId: string;
  projectId: string | null;
  title: string;
  getContent: () => string;
  getSelection: () => { text: string; start: number; end: number };
  onInsert: (text: string, where: "top" | "end") => void;
  onReplaceSelection: (text: string, range: { start: number; end: number }) => void;
  onSetTitle: (title: string) => void;
}

/**
 * AI actions for a note. Every call is explicit, sends only this note (or the selected
 * text), and returns an editable preview — nothing is applied without confirmation.
 */
export function NoteAiMenu(props: NoteAiProps) {
  const { aiEnabled, today } = useApp();
  const ai = useAi();
  const [result, setResult] = useState<Result | null>(null);
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [creating, setCreating] = useState(false);

  if (!aiEnabled) return null;

  const content = () => props.getContent();
  const tooLong = (s: string, max: number) => {
    if (s.length > max) {
      toast.error(`This is too long for one AI request (${s.length.toLocaleString()} / ${max.toLocaleString()} characters). Select a shorter part.`);
      return true;
    }
    return false;
  };

  const summarize = async () => {
    const sel = props.getSelection();
    const text = sel.text || content();
    if (!text.trim()) return toast.error("The note is empty.");
    if (tooLong(text, AI_LIMITS.noteChars)) return;
    const r = await ai.run({ op: "summarize", title: props.title, content: text });
    if (r) setResult({ kind: "summary", text: r.text });
  };
  const extract = async () => {
    const sel = props.getSelection();
    const text = sel.text || content();
    if (!text.trim()) return toast.error("There's nothing to extract tasks from.");
    if (tooLong(text, AI_LIMITS.noteChars)) return;
    const r = await ai.run({ op: "extract-tasks", title: props.title, content: text, today });
    if (r) {
      if (!r.tasks.length) toast.info("No actionable tasks found in this note.");
      else setResult({ kind: "tasks", tasks: r.tasks.map((t) => ({ ...t, keep: true })) });
    }
  };
  const suggestTitle = async () => {
    const text = content();
    if (!text.trim()) return toast.error("Write something first.");
    const r = await ai.run({ op: "title", content: text.slice(0, 8000) });
    if (r) setResult({ kind: "title", title: r.title });
  };
  const rewrite = async (mode: "shorten" | "clarify" | "reorganize" | "fix") => {
    const sel = props.getSelection();
    if (!sel.text.trim()) return toast.error("Select some text in the editor first.");
    if (tooLong(sel.text, AI_LIMITS.rewriteChars)) return;
    setRange({ start: sel.start, end: sel.end });
    const r = await ai.run({ op: "rewrite", mode, text: sel.text });
    if (r) setResult({ kind: "rewrite", text: r.text, original: sel.text, mode });
  };

  const createTasks = async () => {
    if (result?.kind !== "tasks") return;
    const chosen = result.tasks.filter((t) => t.keep && t.title.trim());
    if (!chosen.length) return setResult(null);
    setCreating(true);
    let created = 0;
    for (const t of chosen) {
      const r = await act(
        createTaskAction({
          title: t.title.trim(),
          description: t.notes ?? "",
          dueDate: t.dueDate,
          priority: t.priority ? PRIORITY_MAP[t.priority] : undefined,
          noteId: props.noteId,
          projectId: props.projectId,
        }),
      );
      if (r) created++;
    }
    setCreating(false);
    if (created) toast.success(`Created ${created} ${created === 1 ? "task" : "tasks"} linked to this note`);
    setResult(null);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Couldn't copy to the clipboard.");
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="AI actions">
            {ai.loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            <span className="hidden sm:inline">{ai.loading ? "Working…" : "AI"}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {ai.loading ? (
            <DropdownMenuItem onSelect={ai.cancel}>Cancel current request</DropdownMenuItem>
          ) : (
            <>
              <DropdownMenuLabel className="text-xs text-muted-foreground">This note (or selection)</DropdownMenuLabel>
              <DropdownMenuItem onSelect={summarize}>Summarize</DropdownMenuItem>
              <DropdownMenuItem onSelect={extract}>Extract tasks…</DropdownMenuItem>
              <DropdownMenuItem onSelect={suggestTitle}>Suggest a title</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">Selected text</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => rewrite("shorten")}>Shorten</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => rewrite("clarify")}>Clarify</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => rewrite("reorganize")}>Reorganize</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => rewrite("fix")}>Fix spelling & grammar</DropdownMenuItem>
              <DropdownMenuSeparator />
              <p className="px-2 py-1.5 text-[0.7rem] leading-snug text-muted-foreground">
                Sends only this note or selection to Groq. Results are previews — nothing changes until you approve.
              </p>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          {result?.kind === "summary" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand" /> Summary
                </DialogTitle>
                <DialogDescription>AI-generated. Edit before inserting, or just copy it.</DialogDescription>
              </DialogHeader>
              <textarea
                value={result.text}
                onChange={(e) => setResult({ kind: "summary", text: e.target.value })}
                className={cn(fieldInputClass, "field-sizing-content h-auto min-h-40 py-2 leading-relaxed")}
                aria-label="Summary"
              />
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="ghost" onClick={() => copy(result.text)}>
                  <Copy /> Copy
                </Button>
                <Button variant="outline" onClick={() => { props.onInsert(`## Summary\n${result.text}\n\n`, "top"); setResult(null); }}>
                  Insert at top
                </Button>
                <Button onClick={() => { props.onInsert(`\n\n## Summary\n${result.text}\n`, "end"); setResult(null); }}>
                  Append to note
                </Button>
              </DialogFooter>
            </>
          )}
          {result?.kind === "tasks" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand" /> Suggested tasks
                </DialogTitle>
                <DialogDescription>Review, edit or untick before creating. Tasks will be linked to this note.</DialogDescription>
              </DialogHeader>
              <ul className="space-y-2">
                {result.tasks.map((t, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Checkbox
                      className="mt-2"
                      checked={t.keep}
                      aria-label={`Include task ${i + 1}`}
                      onCheckedChange={(v) =>
                        setResult({ kind: "tasks", tasks: result.tasks.map((x, j) => (j === i ? { ...x, keep: v === true } : x)) })
                      }
                    />
                    <div className="grid min-w-0 flex-1 gap-1.5 sm:grid-cols-[1fr_9.5rem]">
                      <input
                        value={t.title}
                        aria-label={`Task ${i + 1} title`}
                        onChange={(e) =>
                          setResult({ kind: "tasks", tasks: result.tasks.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })
                        }
                        className={fieldInputClass}
                      />
                      <DateInput
                        value={t.dueDate}
                        aria-label={`Task ${i + 1} due date`}
                        onChange={(d) =>
                          setResult({ kind: "tasks", tasks: result.tasks.map((x, j) => (j === i ? { ...x, dueDate: d } : x)) })
                        }
                      />
                      {t.priority && t.priority !== "medium" && (
                        <span className="text-xs text-muted-foreground sm:col-span-2">Priority: {t.priority}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setResult(null)}>
                  Discard
                </Button>
                <Button onClick={createTasks} disabled={creating}>
                  {creating && <Loader2 className="animate-spin" />}
                  Create {result.tasks.filter((t) => t.keep).length} tasks
                </Button>
              </DialogFooter>
            </>
          )}
          {result?.kind === "title" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand" /> Suggested title
                </DialogTitle>
                <DialogDescription>Edit it if you like.</DialogDescription>
              </DialogHeader>
              <input
                value={result.title}
                onChange={(e) => setResult({ kind: "title", title: e.target.value })}
                className={fieldInputClass}
                aria-label="Suggested title"
                maxLength={300}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => setResult(null)}>
                  Cancel
                </Button>
                <Button onClick={() => { props.onSetTitle(result.title.trim()); setResult(null); }} disabled={!result.title.trim()}>
                  Use this title
                </Button>
              </DialogFooter>
            </>
          )}
          {result?.kind === "rewrite" && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="size-4 text-brand" /> Suggested rewrite
                </DialogTitle>
                <DialogDescription>Your original text is unchanged until you choose Replace.</DialogDescription>
              </DialogHeader>
              <details className="rounded-lg border px-3 py-2 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Original</summary>
                <div className="mt-2 max-h-40 overflow-y-auto">
                  <MarkdownPreview content={result.original} />
                </div>
              </details>
              <textarea
                value={result.text}
                onChange={(e) => setResult({ ...result, text: e.target.value })}
                className={cn(fieldInputClass, "field-sizing-content h-auto min-h-40 py-2 leading-relaxed")}
                aria-label="Rewritten text"
              />
              <DialogFooter className="flex-wrap gap-2">
                <Button variant="ghost" onClick={() => copy(result.text)}>
                  <Copy /> Copy
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (range) props.onReplaceSelection(`${result.original}\n\n${result.text}`, range);
                    setResult(null);
                  }}
                >
                  Insert below original
                </Button>
                <Button
                  onClick={() => {
                    if (range) props.onReplaceSelection(result.text, range);
                    setResult(null);
                  }}
                >
                  Replace selection
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
