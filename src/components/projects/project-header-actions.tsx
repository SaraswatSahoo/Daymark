"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/common/confirm";
import { ProjectDialog } from "./project-dialog";
import { NewNoteButton } from "@/components/notes/create-note-button";
import { act } from "@/lib/client/action";
import { archiveProjectAction, deleteProjectAction } from "@/server/actions/organize";
import type { ProjectDTO } from "@/lib/types";

export function ProjectHeaderActions({ project }: { project: ProjectDTO }) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const confirm = useConfirm();
  return (
    <>
      <NewNoteButton projectId={project.id} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label="Project actions">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Edit / rename
          </DropdownMenuItem>
          {project.archivedAt ? (
            <DropdownMenuItem onSelect={() => void act(archiveProjectAction(project.id, false), { success: "Project restored" })}>
              <ArchiveRestore /> Restore
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void act(archiveProjectAction(project.id, true), { success: "Project archived" })}>
              <Archive /> Archive
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={async () => {
              if (
                await confirm({
                  title: `Delete “${project.name}”?`,
                  description: "Its tasks and notes are kept and become unassigned. This can't be undone.",
                  confirmLabel: "Delete project",
                  destructive: true,
                })
              ) {
                const r = await act(deleteProjectAction(project.id, false), { success: "Project deleted" });
                if (r !== undefined) router.push("/projects");
              }
            }}
          >
            <Trash2 /> Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProjectDialog
        open={editing}
        onOpenChange={setEditing}
        initial={{ id: project.id, name: project.name, description: project.description, color: project.color, icon: project.icon }}
      />
    </>
  );
}
