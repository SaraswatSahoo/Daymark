"use client";

import { Plus } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";

export function InboxCaptureButton() {
  const { openCapture } = useApp();
  return (
    <Button size="sm" onClick={() => openCapture({ kind: "idea" })}>
      <Plus /> Capture
    </Button>
  );
}
