export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Completed",
};

export const PRIORITIES = [0, 1, 2, 3] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  0: "Low",
  1: "Medium",
  2: "High",
  3: "Urgent",
};

export const REMINDER_STATUSES = ["pending", "done", "dismissed"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

/** Named colors used for projects and tags. Mapped to Tailwind classes in `colors.ts`. */
export const ITEM_COLORS = [
  "slate",
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "sky",
  "indigo",
  "violet",
  "pink",
] as const;
export type ItemColor = (typeof ITEM_COLORS)[number];

export const ACCENTS = ["indigo", "blue", "teal", "green", "amber", "rose", "violet", "graphite"] as const;
export type Accent = (typeof ACCENTS)[number];

export const THEMES = ["light", "dark", "system"] as const;
export type ThemePref = (typeof THEMES)[number];

export const DATE_FORMATS = ["MMM d, yyyy", "d MMM yyyy", "yyyy-MM-dd", "MM/dd/yyyy", "dd/MM/yyyy"] as const;
export const TIME_FORMATS = ["12h", "24h"] as const;

export const DASHBOARD_SECTIONS = [
  { id: "focus", label: "Today's priorities" },
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Due today" },
  { id: "reminders", label: "Upcoming reminders" },
  { id: "week", label: "This week" },
  { id: "notes", label: "Recently edited notes" },
  { id: "inbox", label: "Inbox preview" },
] as const;
export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]["id"];

export const SNOOZE_OPTIONS = [
  { minutes: 10, label: "10 minutes" },
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 180, label: "3 hours" },
  { minutes: 24 * 60, label: "Tomorrow" },
] as const;

export const LIMITS = {
  title: 300,
  description: 20_000,
  noteContent: 500_000,
  inboxContent: 5_000,
  tagName: 40,
  projectName: 80,
  subtasks: 100,
  searchQuery: 200,
} as const;
