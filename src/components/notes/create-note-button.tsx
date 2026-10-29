"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { act } from "@/lib/client/action";
import { createNoteAction } from "@/server/actions/notes";
import { NOTE_TEMPLATES } from "@/lib/templates";

export function useCreateNote() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const create = async (input: { template?: string; title?: string; projectId?: string | null }) => {
    setBusy(true);
    const note = await act(createNoteAction(input));
    setBusy(false);
    if (note) router.push(`/notes/${note.id}`);
  };
  return { create, busy };
}

/** "New note" split button with a template picker. */
export function NewNoteButton({ projectId }: { projectId?: string | null }) {
  const { create, busy } = useCreateNote();
  return (
    <div className="flex">
      <Button size="sm" className="rounded-r-none" disabled={busy} onClick={() => create({ projectId })}>
        {busy ? <Loader2 className="animate-spin" /> : <Plus />} New note
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="rounded-l-none border-l border-l-white/20 px-1.5" aria-label="New note from template" disabled={busy}>
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Start from a template</DropdownMenuLabel>
          {NOTE_TEMPLATES.map((t) => (
            <DropdownMenuItem key={t.id} onSelect={() => create({ template: t.id, projectId })} className="flex-col items-start gap-0">
              <span>{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.description}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CreateNoteWithTitle({ title }: { title: string }) {
  const { create, busy } = useCreateNote();
  return (
    <Button size="sm" disabled={busy} onClick={() => create({ title, template: "blank" })}>
      <Plus /> Create “{title}”
    </Button>
  );
}
