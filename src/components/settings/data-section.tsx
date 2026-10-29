"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FileArchive, FileJson, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ImportSummary } from "@/lib/backup-schema";

const LABELS: Record<keyof ImportSummary["counts"], string> = {
  projects: "Projects",
  tags: "Tags",
  notes: "Notes",
  tasks: "Tasks",
  reminders: "Reminders",
  inboxItems: "Inbox ideas",
};

export function DataSection() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [payload, setPayload] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<{ merge: ImportSummary; replace: ImportSummary } | null>(null);
  const [mode, setMode] = useState<"merge" | "replace">("merge");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const post = async (body: string, m: "merge" | "replace", dryRun: boolean): Promise<ImportSummary> => {
    const res = await fetch(`/api/import?mode=${m}${dryRun ? "&dryRun=1" : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `Import failed (${res.status})`);
    return data as ImportSummary;
  };

  const onFile = async (file: File) => {
    if (file.size > 50_000_000) return toast.error("That file is larger than 50 MB.");
    setBusy(true);
    try {
      const text = await file.text();
      try {
        JSON.parse(text);
      } catch {
        throw new Error("That file isn't valid JSON.");
      }
      const [merge, replace] = await Promise.all([post(text, "merge", true), post(text, "replace", true)]);
      setPayload(text);
      setFileName(file.name);
      setPreview({ merge, replace });
      setMode("merge");
      setConfirmText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read that file.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const runImport = async () => {
    if (!payload) return;
    setBusy(true);
    try {
      const summary = await post(payload, mode, false);
      const added = Object.values(summary.counts).reduce((n, c) => n + c.added, 0);
      toast.success(
        mode === "merge" ? `Imported ${added} new items` : `Restored backup (${added} items)`,
        summary.preImportBackup ? { description: `Your previous data was saved to ${summary.preImportBackup}` } : undefined,
      );
      setPreview(null);
      setPayload(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  const summary = preview?.[mode];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <Button asChild variant="outline" className="justify-start">
          <a href="/api/export?format=json" download>
            <FileJson /> Full backup (JSON)
          </a>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <a href="/api/export?format=markdown" download>
            <FileArchive /> Notes as Markdown (.zip)
          </a>
        </Button>
        <Button asChild variant="outline" className="justify-start">
          <a href="/api/export?format=ics" download>
            <CalendarDays /> Calendar (.ics)
          </a>
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          id="import-file"
          onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
        />
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? <Loader2 className="animate-spin" /> : <Upload />} Import a backup…
        </Button>
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          You&apos;ll see exactly what will change before anything is written. Existing items are never overwritten in merge mode.
        </p>
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Import {fileName}</DialogTitle>
            <DialogDescription>Review what will happen, then confirm.</DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Import mode" className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["merge", "Merge (safe)", "Add items that aren't already here. Nothing existing is changed."],
                ["replace", "Replace everything", "Delete all current data and restore this backup. A copy of your current data is saved first."],
              ] as const
            ).map(([m, title, desc]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                className={`rounded-lg border p-3 text-left text-sm transition-colors ${mode === m ? "border-brand bg-brand-soft" : "hover:bg-muted"}`}
              >
                <span className="font-medium">{title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{desc}</span>
              </button>
            ))}
          </div>
          {summary && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Type</th>
                  <th className="py-1 text-right font-medium">In file</th>
                  <th className="py-1 text-right font-medium">{mode === "merge" ? "New" : "Restored"}</th>
                  {mode === "merge" && <th className="py-1 text-right font-medium">Already here</th>}
                </tr>
              </thead>
              <tbody>
                {(Object.keys(LABELS) as (keyof typeof LABELS)[]).map((k) => (
                  <tr key={k} className="border-t">
                    <td className="py-1.5">{LABELS[k]}</td>
                    <td className="py-1.5 text-right tabular-nums">{summary.counts[k].incoming}</td>
                    <td className="py-1.5 text-right tabular-nums">{summary.counts[k].added}</td>
                    {mode === "merge" && <td className="py-1.5 text-right tabular-nums text-muted-foreground">{summary.counts[k].skipped}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {mode === "replace" && (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <label htmlFor="replace-confirm" className="text-sm">
                This deletes all current data. Type <strong>REPLACE</strong> to confirm.
              </label>
              <input
                id="replace-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className="h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
                autoComplete="off"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreview(null)}>
              Cancel
            </Button>
            <Button
              variant={mode === "replace" ? "destructive" : "default"}
              disabled={busy || (mode === "replace" && confirmText !== "REPLACE")}
              onClick={runImport}
            >
              {busy && <Loader2 className="animate-spin" />}
              {mode === "merge" ? "Import" : "Replace all data"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
