import "server-only";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { formatZodError } from "@/lib/validation";
import type { ActionResult } from "@/lib/types";

/** Errors whose message is safe and useful to show to the user. */
export class UserError extends Error {}

export function toErrorMessage(error: unknown): string {
  if (error instanceof ZodError) return formatZodError(error);
  if (error instanceof UserError) return error.message;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") return "That item no longer exists.";
    if (error.code === "P2002") return "An item with that name already exists.";
    if (error.code === "P2003") return "A linked item no longer exists.";
  }
  console.error("[action] unexpected error:", error instanceof Error ? error.message : error);
  return "Something went wrong. Please try again.";
}

/** Runs a mutation and converts thrown errors into a typed failure result. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: toErrorMessage(error) };
  }
}
