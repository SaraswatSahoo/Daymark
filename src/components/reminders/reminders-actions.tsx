"use client";

import { Plus } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";

export function RemindersActions() {
  const { openReminder } = useApp();
  return (
    <Button size="sm" onClick={() => openReminder({})}>
      <Plus /> New reminder
    </Button>
  );
}
