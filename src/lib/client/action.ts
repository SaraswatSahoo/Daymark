"use client";

import { toast } from "sonner";
import type { ActionResult } from "@/lib/types";

/**
 * Calls a server action and reports failures. Success toasts are only shown after
 * the server confirms the write.
 *
 * Resolves to `undefined` only on failure. Actions that return nothing resolve to
 * `true` on success, so callers can always test `result !== undefined`.
 */
export async function act<T>(
  promise: Promise<ActionResult<T>>,
  opts: { success?: string | ((data: T) => string); error?: string; undo?: () => void } = {},
): Promise<T | undefined> {
  let result: ActionResult<T>;
  try {
    result = await promise;
  } catch {
    toast.error(opts.error ?? "Couldn't reach the server. Your change was not saved.");
    return undefined;
  }
  if (!result.ok) {
    toast.error(result.error);
    return undefined;
  }
  if (opts.success) {
    const message = typeof opts.success === "function" ? opts.success(result.data) : opts.success;
    toast.success(message, opts.undo ? { action: { label: "Undo", onClick: opts.undo } } : undefined);
  }
  return result.data === undefined ? (true as T) : result.data;
}
