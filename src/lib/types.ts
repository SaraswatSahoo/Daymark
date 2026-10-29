import type { Recurrence } from "./recurrence";

export type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export interface TagDTO {
  id: string;
  name: string;
  color: string;
}

export interface ProjectRef {
  id: string;
  name: string;
  color: string;
  icon: string | null;
}

export interface SubtaskDTO {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskDTO {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "done";
  priority: number;
  dueDate: string | null;
  dueTime: string | null;
  myDayDate: string | null;
  inbox: boolean;
  sortOrder: number;
  recurrence: Recurrence | null;
  completedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectRef | null;
  note: { id: string; title: string } | null;
  tags: TagDTO[];
  subtaskCount: number;
  subtaskDone: number;
  nextReminderAt: string | null;
}

export interface TaskDetailDTO extends TaskDTO {
  subtasks: SubtaskDTO[];
  reminders: ReminderDTO[];
}

export interface NoteSummaryDTO {
  id: string;
  title: string;
  excerpt: string;
  pinned: boolean;
  inbox: boolean;
  journalDate: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  project: ProjectRef | null;
  tags: TagDTO[];
}

export interface NoteDetailDTO extends NoteSummaryDTO {
  content: string;
  tasks: TaskDTO[];
  related: { id: string; title: string }[];
  backlinks: { id: string; title: string }[];
}

export interface ReminderDTO {
  id: string;
  title: string;
  description: string;
  remindAt: string;
  status: "pending" | "done" | "dismissed";
  recurrence: Recurrence | null;
  notifiedAt: string | null;
  snoozeCount: number;
  completedAt: string | null;
  dismissedAt: string | null;
  task: { id: string; title: string } | null;
  note: { id: string; title: string } | null;
  project: ProjectRef | null;
}

export interface ProjectDTO extends ProjectRef {
  description: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  openTasks: number;
  doneTasks: number;
  noteCount: number;
}

export interface InboxItemDTO {
  id: string;
  content: string;
  createdAt: string;
}

export interface ClientSettings {
  displayName: string;
  theme: string;
  accent: string;
  tz: string;
  timezone: string | null;
  weekStart: number;
  dateFormat: string;
  timeFormat: string;
  defaultPriority: number;
  defaultReminderTime: string;
  defaultSnoozeMinutes: number;
  dashboardLayout: { id: string; visible: boolean }[];
}

export interface SearchResults {
  query: string;
  tasks: { id: string; title: string; snippet: string; status: string; dueDate: string | null }[];
  notes: { id: string; title: string; snippet: string; updatedAt: string }[];
  projects: { id: string; name: string; color: string }[];
  reminders: { id: string; title: string; remindAt: string; status: string }[];
}
