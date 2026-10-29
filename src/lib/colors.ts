/** Tailwind class sets for project and tag colors (kept literal so Tailwind can see them). */
export const COLOR_CLASSES: Record<string, { dot: string; soft: string; text: string }> = {
  slate: { dot: "bg-stone-400", soft: "bg-stone-500/10", text: "text-stone-600 dark:text-stone-300" },
  red: { dot: "bg-red-500", soft: "bg-red-500/10", text: "text-red-700 dark:text-red-300" },
  orange: { dot: "bg-orange-500", soft: "bg-orange-500/10", text: "text-orange-700 dark:text-orange-300" },
  amber: { dot: "bg-amber-500", soft: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-300" },
  green: { dot: "bg-emerald-500", soft: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300" },
  teal: { dot: "bg-teal-500", soft: "bg-teal-500/10", text: "text-teal-700 dark:text-teal-300" },
  sky: { dot: "bg-sky-500", soft: "bg-sky-500/10", text: "text-sky-700 dark:text-sky-300" },
  indigo: { dot: "bg-indigo-500", soft: "bg-indigo-500/10", text: "text-indigo-700 dark:text-indigo-300" },
  violet: { dot: "bg-violet-500", soft: "bg-violet-500/10", text: "text-violet-700 dark:text-violet-300" },
  pink: { dot: "bg-pink-500", soft: "bg-pink-500/10", text: "text-pink-700 dark:text-pink-300" },
};

export function colorClasses(color: string | null | undefined) {
  return COLOR_CLASSES[color ?? "slate"] ?? COLOR_CLASSES.slate;
}

export const PRIORITY_STYLES: Record<number, { text: string; ring: string; flag: string }> = {
  0: { text: "text-muted-foreground", ring: "border-muted-foreground/50", flag: "text-muted-foreground/60" },
  1: { text: "text-sky-600 dark:text-sky-400", ring: "border-muted-foreground/60", flag: "text-sky-500" },
  2: { text: "text-amber-600 dark:text-amber-400", ring: "border-amber-500", flag: "text-amber-500" },
  3: { text: "text-red-600 dark:text-red-400", ring: "border-red-500", flag: "text-red-500" },
};

export const ACCENT_SWATCHES: Record<string, string> = {
  indigo: "oklch(0.5 0.15 270)",
  blue: "oklch(0.5 0.15 250)",
  teal: "oklch(0.5 0.1 190)",
  green: "oklch(0.5 0.12 150)",
  amber: "oklch(0.6 0.14 65)",
  rose: "oklch(0.55 0.16 12)",
  violet: "oklch(0.5 0.15 300)",
  graphite: "oklch(0.3 0.005 60)",
};
