import {
  Archive,
  BellRing,
  BookOpen,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  FolderKanban,
  Home,
  Inbox,
  ListChecks,
  NotebookPen,
  Sparkles,
  Sun,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: "inbox" | "reminders";
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/inbox", label: "Inbox", icon: Inbox, badge: "inbox" },
  { href: "/today", label: "My Day", icon: Sun },
  { href: "/upcoming", label: "Upcoming", icon: CalendarRange },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
];

export const LIBRARY_NAV: NavItem[] = [
  { href: "/tasks", label: "All Tasks", icon: ListChecks },
  { href: "/notes", label: "Notes", icon: NotebookPen },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/reminders", label: "Reminders", icon: BellRing, badge: "reminders" },
  { href: "/projects", label: "Projects", icon: FolderKanban },
];

export const REVIEW_NAV: NavItem[] = [
  { href: "/review", label: "Weekly Review", icon: Sparkles },
  { href: "/completed", label: "Completed", icon: CheckCircle2 },
  { href: "/archive", label: "Archive", icon: Archive },
];

export const ALL_NAV = [...PRIMARY_NAV, ...LIBRARY_NAV, ...REVIEW_NAV];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
