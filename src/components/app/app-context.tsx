"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ClientSettings, ProjectRef, TagDTO } from "@/lib/types";
import type { CaptureKind } from "@/lib/capture-parser";

export interface CaptureDefaults {
  kind?: CaptureKind;
  text?: string;
  date?: string | null;
  time?: string | null;
  projectId?: string | null;
  myDay?: boolean;
}

export interface ReminderDialogState {
  id?: string;
  title?: string;
  date?: string;
  time?: string;
  taskId?: string;
  noteId?: string;
}

interface AppContextValue {
  settings: ClientSettings;
  today: string;
  projects: ProjectRef[];
  tags: TagDTO[];
  aiEnabled: boolean;
  inboxCount: number;
  dueReminderCount: number;
  // Overlays
  captureState: CaptureDefaults | null;
  openCapture: (defaults?: CaptureDefaults) => void;
  closeCapture: () => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  taskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
  reminderState: ReminderDialogState | null;
  openReminder: (state?: ReminderDialogState) => void;
  closeReminder: () => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
  settings,
  today,
  projects,
  tags,
  aiEnabled,
  inboxCount,
  dueReminderCount,
  initialCollapsed,
}: {
  children: ReactNode;
  settings: ClientSettings;
  today: string;
  projects: ProjectRef[];
  tags: TagDTO[];
  aiEnabled: boolean;
  inboxCount: number;
  dueReminderCount: number;
  initialCollapsed: boolean;
}) {
  const [captureState, setCaptureState] = useState<CaptureDefaults | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [taskId, setTaskId] = useState<string | null>(null);
  const [reminderState, setReminderState] = useState<ReminderDialogState | null>(null);
  const [sidebarCollapsed, setCollapsed] = useState(initialCollapsed);

  const openCapture = useCallback((defaults?: CaptureDefaults) => {
    setPaletteOpen(false);
    setCaptureState(defaults ?? {});
  }, []);
  const closeCapture = useCallback(() => setCaptureState(null), []);
  const openTask = useCallback((id: string) => {
    setPaletteOpen(false);
    setTaskId(id);
  }, []);
  const closeTask = useCallback(() => setTaskId(null), []);
  const openReminder = useCallback((state?: ReminderDialogState) => {
    setPaletteOpen(false);
    setReminderState(state ?? {});
  }, []);
  const closeReminder = useCallback(() => setReminderState(null), []);
  const setSidebarCollapsed = useCallback((v: boolean) => {
    setCollapsed(v);
    document.cookie = `daymark_sidebar=${v ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }, []);

  const value = useMemo<AppContextValue>(
    () => ({
      settings,
      today,
      projects,
      tags,
      aiEnabled,
      inboxCount,
      dueReminderCount,
      captureState,
      openCapture,
      closeCapture,
      paletteOpen,
      setPaletteOpen,
      taskId,
      openTask,
      closeTask,
      reminderState,
      openReminder,
      closeReminder,
      sidebarCollapsed,
      setSidebarCollapsed,
    }),
    [
      settings,
      today,
      projects,
      tags,
      aiEnabled,
      inboxCount,
      dueReminderCount,
      captureState,
      openCapture,
      closeCapture,
      paletteOpen,
      taskId,
      openTask,
      closeTask,
      reminderState,
      openReminder,
      closeReminder,
      sidebarCollapsed,
      setSidebarCollapsed,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}
