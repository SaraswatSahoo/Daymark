"use client";

import { Bell, Plus } from "lucide-react";
import { useApp } from "@/components/app/app-context";
import { Button } from "@/components/ui/button";

export function UpcomingActions({ date }: { date?: string }) {
  const { openCapture, openReminder } = useApp();
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => openReminder({ date })}>
        <Bell /> Reminder
      </Button>
      <Button size="sm" onClick={() => openCapture({ kind: "task", date })}>
        <Plus /> Task
      </Button>
    </>
  );
}
