/**
 * Optional single-user password protection (APP_PASSWORD). The session cookie holds an
 * HMAC of a fixed message keyed by the session secret, so it can be verified in the
 * proxy without a database. Changing APP_PASSWORD or SESSION_SECRET signs everyone out.
 * Uses Web Crypto so it works in both the proxy and Node runtimes.
 */
export const SESSION_COOKIE = "daymark_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

function secret(): string {
  return process.env.SESSION_SECRET || `daymark:${process.env.APP_PASSWORD ?? ""}`;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionToken(): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(`session:v1:${process.env.APP_PASSWORD ?? ""}`)));
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function isValidSession(value: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!value) return false;
  return safeEqual(value, await sessionToken());
}
