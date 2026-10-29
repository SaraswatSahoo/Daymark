"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "./app-context";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SHORTCUTS: [string, string][] = [
  ["Ctrl/⌘ K", "Command palette & search"],
  ["Q", "Quick capture"],
  ["/", "Search"],
  ["G then H", "Go to Home"],
  ["G then I", "Go to Inbox"],
  ["G then D", "Go to My Day"],
  ["G then U", "Go to Upcoming"],
  ["G then C", "Go to Calendar"],
  ["G then T", "Go to All Tasks"],
  ["G then N", "Go to Notes"],
  ["G then J", "Open today's journal"],
  ["?", "Show keyboard shortcuts"],
  ["Esc", "Close dialogs and panels"],
];

const GOTO: Record<string, string> = {
  h: "/",
  i: "/inbox",
  d: "/today",
  u: "/upcoming",
  c: "/calendar",
  t: "/tasks",
  n: "/notes",
  j: "/journal",
  p: "/projects",
  r: "/reminders",
  s: "/settings",
};

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Global keyboard shortcuts. Single-letter shortcuts only fire outside text fields. */
export function KeyboardShortcuts() {
  const { setPaletteOpen, paletteOpen, openCapture, captureState } = useApp();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    let gPressed = 0;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.querySelector("[role=dialog]")) return;
      const key = e.key.toLowerCase();
      if (gPressed && Date.now() - gPressed < 1200 && GOTO[key]) {
        e.preventDefault();
        gPressed = 0;
        router.push(GOTO[key]);
        return;
      }
      gPressed = 0;
      if (key === "g") gPressed = Date.now();
      else if (key === "q" && !captureState) {
        e.preventDefault();
        openCapture();
      } else if (e.key === "/") {
        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setPaletteOpen, paletteOpen, openCapture, captureState, router]);

  return (
    <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Letter shortcuts work when you are not typing in a field.</DialogDescription>
        </DialogHeader>
        <dl className="divide-y text-sm">
          {SHORTCUTS.map(([keys, label]) => (
            <div key={keys} className="flex items-center justify-between py-2">
              <dt className="text-muted-foreground">{label}</dt>
              <dd>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-xs font-medium">{keys}</kbd>
              </dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
