import { NextResponse, type NextRequest } from "next/server";
import { searchAll } from "@/server/services/search";
import { jsonError } from "@/server/http";

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") ?? "";
    return NextResponse.json(await searchAll(q), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
