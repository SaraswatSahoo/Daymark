import { exportAll, exportNotesZip } from "@/server/services/backup";
import { buildIcs } from "@/server/services/ics";
import { getSettings } from "@/server/services/settings";
import { jsonError } from "@/server/http";
import type { NextRequest } from "next/server";

const stamp = () => new Date().toISOString().slice(0, 10);

/** GET /api/export?format=json|markdown|ics */
export async function GET(request: NextRequest) {
  try {
    const format = request.nextUrl.searchParams.get("format") ?? "json";
    if (format === "markdown") {
      const zip = await exportNotesZip();
      return new Response(Buffer.from(zip), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="daymark-notes-${stamp()}.zip"`,
          "Cache-Control": "no-store",
        },
      });
    }
    if (format === "ics") {
      const { tz } = await getSettings();
      return new Response(await buildIcs(tz), {
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": `attachment; filename="daymark-${stamp()}.ics"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const backup = await exportAll();
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="daymark-backup-${stamp()}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
