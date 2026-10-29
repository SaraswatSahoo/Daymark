import "server-only";
import type { Settings } from "@prisma/client";
import { db } from "../db";
import { DASHBOARD_SECTIONS, type DashboardSectionId } from "@/lib/constants";
import { resolveTimezone, todayISO } from "@/lib/dates";
import { dashboardLayoutSchema, type SettingsUpdateInput, settingsUpdateSchema } from "@/lib/validation";

export type AppSettings = Omit<Settings, "dashboardLayout" | "updatedAt"> & {
  dashboardLayout: { id: DashboardSectionId; visible: boolean }[];
  /** Effective timezone (configured or server default). */
  tz: string;
};

/** Normalizes a stored layout: unknown sections are dropped and new ones appended. */
export function normalizeDashboardLayout(raw: string): AppSettings["dashboardLayout"] {
  let parsed: { id: string; visible: boolean }[] = [];
  try {
    const result = dashboardLayoutSchema.safeParse(JSON.parse(raw));
    if (result.success) parsed = result.data;
  } catch {
    // fall through to defaults
  }
  const known = new Set<string>(DASHBOARD_SECTIONS.map((s) => s.id));
  const seen = new Set<string>();
  const layout: AppSettings["dashboardLayout"] = [];
  for (const item of parsed) {
    if (known.has(item.id) && !seen.has(item.id)) {
      seen.add(item.id);
      layout.push({ id: item.id as DashboardSectionId, visible: item.visible });
    }
  }
  for (const s of DASHBOARD_SECTIONS) if (!seen.has(s.id)) layout.push({ id: s.id, visible: true });
  return layout;
}

function toAppSettings(row: Settings): AppSettings {
  const { dashboardLayout, updatedAt: _updatedAt, ...rest } = row;
  return { ...rest, dashboardLayout: normalizeDashboardLayout(dashboardLayout), tz: resolveTimezone(row.timezone) };
}

export async function getSettings(): Promise<AppSettings> {
  const row = await db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return toAppSettings(row);
}

export async function getToday(): Promise<{ settings: AppSettings; today: string }> {
  const settings = await getSettings();
  return { settings, today: todayISO(settings.tz) };
}

export async function updateSettings(input: SettingsUpdateInput): Promise<AppSettings> {
  const data = settingsUpdateSchema.parse(input);
  const { dashboardLayout, ...rest } = data;
  const row = await db.settings.upsert({
    where: { id: 1 },
    update: { ...rest, ...(dashboardLayout ? { dashboardLayout: JSON.stringify(dashboardLayout) } : {}) },
    create: { id: 1, ...rest, ...(dashboardLayout ? { dashboardLayout: JSON.stringify(dashboardLayout) } : {}) },
  });
  return toAppSettings(row);
}
