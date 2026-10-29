import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { importBackup } from "@/server/services/backup";
import { assertSameOrigin, jsonError, readJson } from "@/server/http";

/**
 * POST /api/import?mode=merge|replace&dryRun=1
 * Always call with dryRun first to show the user what will happen.
 */
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const mode = request.nextUrl.searchParams.get("mode") === "replace" ? "replace" : "merge";
    const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
    const body = await readJson(request, 60_000_000);
    const summary = await importBackup(body, mode, dryRun);
    if (!dryRun) revalidatePath("/", "layout");
    return NextResponse.json(summary);
  } catch (error) {
    return jsonError(error);
  }
}
