"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { act } from "@/lib/client/action";
import { createProjectAction, updateProjectAction } from "@/server/actions/organize";
import { ITEM_COLORS, type ItemColor } from "@/lib/constants";
import { colorClasses } from "@/lib/colors";
import { cn } from "@/lib/utils";

export interface ProjectFormValue {
  id?: string;
  name: string;
  description: string;
  color: string;
  icon: string | null;
}

export function ProjectDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: ProjectFormValue;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>Projects group related tasks and notes — a course, an internship, a side project, a goal.</DialogDescription>
        </DialogHeader>
        {open && <ProjectForm initial={initial} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({ initial, onDone }: { initial?: ProjectFormValue; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [color, setColor] = useState<string>(initial?.color ?? "indigo");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return setError("Give the project a name.");
    setSaving(true);
    const payload = { name: name.trim(), description, color: color as ItemColor, icon: icon.trim() || null };
    if (initial?.id) {
      const r = await act(updateProjectAction({ id: initial.id, ...payload }), { success: "Project updated" });
      setSaving(false);
      if (r !== undefined) onDone();
    } else {
      const p = await act(createProjectAction(payload), { success: "Project created" });
      setSaving(false);
      if (p) {
        onDone();
        router.push(`/projects/${p.id}`);
      }
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="space-y-4"
    >
      <div className="flex gap-2">
        <div className="w-16 space-y-1.5">
          <label htmlFor="project-icon" className="text-sm font-medium">
            Icon
          </label>
          <Input id="project-icon" value={icon} onChange={(e) => setIcon(e.target.value.slice(0, 4))} placeholder="📘" className="text-center" />
        </div>
        <div className="flex-1 space-y-1.5">
          <label htmlFor="project-name" className="text-sm font-medium">
            Name
          </label>
          <Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus aria-invalid={!!error} />
        </div>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="project-description" className="text-sm font-medium">
          Description <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <Textarea id="project-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={2000} />
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {ITEM_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              aria-pressed={color === c}
              className={cn(
                "size-7 rounded-full ring-offset-2 ring-offset-background transition-shadow",
                colorClasses(c).dot,
                color === c && "ring-2 ring-foreground",
              )}
            />
          ))}
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {initial?.id ? "Save" : "Create project"}
        </Button>
      </DialogFooter>
    </form>
  );
}
