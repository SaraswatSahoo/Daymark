"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

interface Snapshot {
  title: string;
  content: string;
}

interface Conflict {
  title: string;
  content: string;
  updatedAt: string;
}

const DRAFT_PREFIX = "daymark:draft:";

export function readDraft(noteId: string): (Snapshot & { savedAt: number }) | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + noteId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft(noteId: string, snap: Snapshot) {
  try {
    localStorage.setItem(DRAFT_PREFIX + noteId, JSON.stringify({ ...snap, savedAt: Date.now() }));
  } catch {
    // Storage full or unavailable; the server save is still attempted.
  }
}

export function clearDraft(noteId: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + noteId);
  } catch {
    // ignore
  }
}

/**
 * Debounced autosave for a note.
 * - Every edit is mirrored to localStorage first, so nothing is lost if the network or
 *   server fails, the tab crashes, or the component unmounts mid-save.
 * - Pending edits are flushed with `keepalive` on page hide and on unmount.
 * - The server rejects saves based on a stale version (edited elsewhere) with a conflict.
 */
export function useNoteAutosave(noteId: string, initial: Snapshot & { updatedAt: string }, delay = 800) {
  const [state, setState] = useState<SaveState>("saved");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string>(initial.updatedAt);
  const current = useRef<Snapshot>({ title: initial.title, content: initial.content });
  const saved = useRef<Snapshot>({ title: initial.title, content: initial.content });
  const base = useRef(initial.updatedAt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const conflictRef = useRef(false);
  const saveRef = useRef<(opts?: { force?: boolean; keepalive?: boolean }) => Promise<void>>(async () => {});

  const isDirty = () =>
    current.current.title !== saved.current.title || current.current.content !== saved.current.content;

  const save = useCallback(
    async (opts: { force?: boolean; keepalive?: boolean } = {}) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (conflictRef.current && !opts.force) return;
      if (!isDirty() && !opts.force) {
        setState("saved");
        return;
      }
      if (inflight.current && !opts.keepalive) await inflight.current;
      const snap = { ...current.current };
      const run = (async () => {
        setState("saving");
        try {
          const res = await fetch(`/api/notes/${noteId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...snap, baseUpdatedAt: base.current, force: opts.force }),
            keepalive: opts.keepalive && JSON.stringify(snap).length < 60_000,
          });
          const data = await res.json().catch(() => ({}));
          if (res.status === 409) {
            conflictRef.current = true;
            setConflict({ title: data.title, content: data.content, updatedAt: data.updatedAt });
            setState("conflict");
            return;
          }
          if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
          saved.current = snap;
          base.current = data.updatedAt;
          setLastSavedAt(data.updatedAt);
          conflictRef.current = false;
          setConflict(null);
          if (!isDirty()) {
            clearDraft(noteId);
            setState("saved");
          } else {
            setState("dirty");
          }
        } catch {
          setState("error");
        }
      })();
      inflight.current = run;
      await run;
      inflight.current = null;
      // Edits made while the request was in flight get their own save.
      if (isDirty() && !conflictRef.current && !opts.keepalive) {
        timer.current = setTimeout(() => void saveRef.current(), delay);
      }
    },
    [noteId, delay],
  );
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const update = useCallback(
    (patch: Partial<Snapshot>) => {
      current.current = { ...current.current, ...patch };
      writeDraft(noteId, current.current);
      if (conflictRef.current) return;
      setState(isDirty() ? "dirty" : "saved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), delay);
    },
    [noteId, delay, save],
  );

  /** Resolve a conflict: overwrite the server copy with mine, or adopt theirs. */
  const resolveConflict = useCallback(
    async (choice: "mine" | "theirs"): Promise<Snapshot | null> => {
      if (!conflict) return null;
      if (choice === "theirs") {
        const theirs = { title: conflict.title, content: conflict.content };
        current.current = theirs;
        saved.current = theirs;
        base.current = conflict.updatedAt;
        conflictRef.current = false;
        setConflict(null);
        clearDraft(noteId);
        setState("saved");
        return theirs;
      }
      conflictRef.current = false;
      setConflict(null);
      await save({ force: true });
      return null;
    },
    [conflict, noteId, save],
  );

  useEffect(() => {
    const flush = () => {
      if (isDirty() && !conflictRef.current) void save({ keepalive: true });
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Client-side navigation away from the editor.
      flush();
    };
  }, [save]);

  return { state, conflict, lastSavedAt, update, saveNow: () => save(), resolveConflict, isDirty };
}
