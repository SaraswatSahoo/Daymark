"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, NotebookPen, Sparkles } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Section } from "@/components/common/page-header";
import { TaskList } from "@/components/tasks/task-list";
import { NoteListView } from "@/components/notes/notes-browser";
import { MarkdownPreview } from "@/components/notes/markdown-preview";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { fieldInputClass } from "@/components/common/fields";
import { useAi } from "@/lib/client/use-ai";
import { act } from "@/lib/client/action";
import { createNoteAction } from "@/server/actions/notes";
import { AI_LIMITS } from "@/lib/ai-schemas";
import { cn } from "@/lib/utils";
import type { NoteSummaryDTO, TaskDTO } from "@/lib/types";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-xs">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ReviewView({
  range,
  start,
  completed,
  open,
  notes,
  createdCount,
}: {
  range: string;
  start: string;
  completed: TaskDTO[];
  open: TaskDTO[];
  notes: NoteSummaryDTO[];
  createdCount: number;
}) {
  const { aiEnabled, today } = useApp();
  const router = useRouter();
  const ai = useAi();
  const [includeCompleted, setIncludeCompleted] = useState(true);
  const [includeOpen, setIncludeOpen] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [reflection, setReflection] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;

  const generate = async () => {
    const r = await ai.run({
      op: "weekly-review",
      range,
      completed: includeCompleted ? completed.slice(0, AI_LIMITS.reviewItems).map((t) => (t.project ? `${t.title} [${t.project.name}]` : t.title)) : [],
      open: includeOpen
        ? open.slice(0, AI_LIMITS.reviewItems).map((t) => `${t.title}${t.dueDate ? ` (due ${t.dueDate}${t.dueDate < today ? ", overdue" : ""})` : ""}`)
        : [],
      notes: includeNotes ? notes.slice(0, 40).map((n) => n.title || "Untitled") : [],
      reflection,
    });
    if (r) {
      setResult(r.text);
      setEditing(false);
    }
  };

  const saveAsNote = async () => {
    if (!result) return;
    const note = await act(
      createNoteAction({
        title: `Weekly review — ${range}`,
        content: `${reflection ? `## My reflection\n${reflection}\n\n` : ""}${result}\n`,
        tags: ["review"],
      }),
      { success: "Saved as a note" },
    );
    if (note) router.push(`/notes/${note.id}`);
  };

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Tasks completed" value={completed.length} />
        <Stat label="Tasks added" value={createdCount} />
        <Stat label="Still open (due by week end)" value={open.length} />
        <Stat label="Notes edited" value={notes.length} />
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-xs sm:p-5" aria-labelledby="reflect-heading">
        <h2 id="reflect-heading" className="font-display text-lg font-semibold">
          Reflect
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What went well? What got in the way? What matters most next week?
        </p>
        <Textarea
          value={reflection}
          onChange={(e) => setReflection(e.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-3"
          aria-label="Your reflection"
          placeholder="A few honest sentences…"
        />
        {aiEnabled ? (
          <div className="mt-4 space-y-3 border-t pt-4">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Sparkles className="size-4 text-brand" /> AI summary <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Choose what to send. Only task and note <em>titles</em> from this week (and your reflection) are shared — never note contents.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {(
                [
                  [includeCompleted, setIncludeCompleted, `Completed tasks (${completed.length})`],
                  [includeOpen, setIncludeOpen, `Open tasks (${open.length})`],
                  [includeNotes, setIncludeNotes, `Note titles (${notes.length})`],
                ] as const
              ).map(([v, set, label]) => (
                <label key={label} className="flex items-center gap-2">
                  <Checkbox checked={v} onCheckedChange={(c) => set(c === true)} />
                  {label}
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={ai.loading ? ai.cancel : generate}>
                {ai.loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {ai.loading ? "Cancel" : result ? "Regenerate" : "Generate review"}
              </Button>
            </div>
            {result && (
              <div className="rounded-lg border bg-background p-4">
                {editing ? (
                  <textarea
                    value={result}
                    onChange={(e) => setResult(e.target.value)}
                    aria-label="Edit review"
                    className={cn(fieldInputClass, "field-sizing-content h-auto min-h-48 py-2 leading-relaxed")}
                  />
                ) : (
                  <MarkdownPreview content={result} />
                )}
                <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                  <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                    {editing ? "Preview" : "Edit"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                    Discard
                  </Button>
                  <Button size="sm" className="ml-auto" onClick={saveAsNote}>
                    <NotebookPen /> Save as note
                  </Button>
                </div>
                <p className="mt-2 text-[0.7rem] text-muted-foreground">
                  Generated from the items you selected only; it doesn&apos;t know anything else about your week.
                </p>
              </div>
            )}
          </div>
        ) : (
          reflection.trim() && (
            <div className="mt-3 flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  const note = await act(
                    createNoteAction({ title: `Weekly review — ${range}`, content: `## My reflection\n${reflection}\n`, tags: ["review"] }),
                    { success: "Saved as a note" },
                  );
                  if (note) router.push(`/notes/${note.id}`);
                }}
              >
                <NotebookPen /> Save reflection as note
              </Button>
            </div>
          )
        )}
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <Section title="Completed this week" count={completed.length}>
          {completed.length ? <TaskList tasks={completed} /> : <p className="px-2 text-sm text-muted-foreground">Nothing completed yet.</p>}
        </Section>
        <Section title={overdue ? `Still open · ${overdue} overdue` : "Still open"} count={open.length}>
          {open.length ? <TaskList tasks={open} /> : <p className="px-2 text-sm text-muted-foreground">Nothing outstanding. 🎉</p>}
        </Section>
      </div>
      {notes.length > 0 && (
        <Section title="Notes edited" count={notes.length}>
          <NoteListView notes={notes} view="list" />
        </Section>
      )}
      <span className="sr-only">Week starting {start}</span>
    </div>
  );
}
