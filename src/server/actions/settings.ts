"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { run } from "../action-result";
import { refreshAll } from "./context";
import { updateSettings } from "../services/settings";
import type { SettingsUpdateInput } from "@/lib/validation";
import { authEnabled, safeEqual, SESSION_COOKIE, SESSION_MAX_AGE, sessionToken } from "@/lib/auth-token";

export async function updateSettingsAction(input: SettingsUpdateInput) {
  return run(async () => {
    const s = await updateSettings(input);
    refreshAll();
    return s;
  });
}

const attempts: number[] = [];

export async function loginAction(_prev: { error?: string } | undefined, formData: FormData) {
  if (!authEnabled()) redirect("/");
  // Basic brute-force protection: at most 10 attempts per minute per server process.
  const now = Date.now();
  while (attempts.length && now - attempts[0] > 60_000) attempts.shift();
  if (attempts.length >= 10) return { error: "Too many attempts. Wait a minute and try again." };
  attempts.push(now);

  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");
  if (!safeEqual(password, process.env.APP_PASSWORD ?? "")) {
    await new Promise((r) => setTimeout(r, 400));
    return { error: "Incorrect password." };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
