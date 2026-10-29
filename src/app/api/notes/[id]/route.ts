import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { saveNoteContent } from "@/server/services/notes";
import { assertSameOrigin, jsonError, readJson } from "@/server/http";

/**
 * Note autosave endpoint. A route handler (rather than a server action) so the editor
 * can flush pending edits with `fetch(..., { keepalive: true })` when the page unloads.
 */
export async function PUT(request: Request, ctx: RouteContext<"/api/notes/[id]">) {
  try {
    assertSameOrigin(request);
    const { id } = await ctx.params;
    const result = await saveNoteContent(id, (await readJson(request, 1_200_000)) as never);
    if (result.status === "conflict") return NextResponse.json(result, { status: 409 });
    revalidatePath("/", "layout");
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
