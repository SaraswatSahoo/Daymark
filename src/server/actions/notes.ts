"use server";

import { z } from "zod";
import { run, UserError } from "../action-result";
import { refreshAll, taskContext } from "./context";
import * as notes from "../services/notes";
import { getTemplate, journalTemplate } from "@/lib/templates";
import { id, isoDate, type NoteUpdateInput } from "@/lib/validation";

export async function createNoteAction(input: {
  title?: string;
  content?: string;
  template?: string;
  projectId?: string | null;
  tags?: string[];
  inbox?: boolean;
}) {
  return run(async () => {
    const { today } = await taskContext();
    const template = getTemplate(input.template);
    const note = await notes.createNote({
      title: input.title ?? template.title(today),
      content: input.content ?? template.content(today),
      projectId: input.projectId,
      tags: input.tags,
      inbox: input.inbox,
    });
    refreshAll();
    return note;
  });
}

export async function updateNoteAction(input: NoteUpdateInput) {
  return run(async () => {
    const note = await notes.updateNote(input);
    refreshAll();
    return note;
  });
}

export async function getNoteAction(noteId: string) {
  return run(async () => {
    const n = await notes.getNote(id.parse(noteId));
    if (!n) throw new UserError("That note no longer exists.");
    return n;
  });
}

export async function archiveNoteAction(noteId: string, archived: boolean) {
  return run(async () => {
    await notes.archiveNote(id.parse(noteId), archived);
    refreshAll();
  });
}

export async function deleteNoteAction(noteId: string) {
  return run(async () => {
    await notes.deleteNote(id.parse(noteId));
    refreshAll();
  });
}

export async function duplicateNoteAction(noteId: string) {
  return run(async () => {
    const newId = await notes.duplicateNote(id.parse(noteId));
    refreshAll();
    return newId;
  });
}

export async function linkNotesAction(fromId: string, toId: string) {
  return run(async () => {
    await notes.linkNotes(id.parse(fromId), id.parse(toId));
    refreshAll();
  });
}

export async function unlinkNotesAction(a: string, b: string) {
  return run(async () => {
    await notes.unlinkNotes(id.parse(a), id.parse(b));
    refreshAll();
  });
}

export async function searchNoteOptionsAction(query: string, excludeId?: string) {
  return run(() => notes.listNoteOptions(z.string().max(200).parse(query), excludeId));
}

export async function openJournalAction(date?: string) {
  return run(async () => {
    const { today } = await taskContext();
    const day = date ? isoDate.parse(date) : today;
    const noteId = await notes.getOrCreateJournal(day, journalTemplate);
    refreshAll();
    return noteId;
  });
}
