import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "dbide_session";

function secret(): string {
  const s = process.env.APP_SECRET;
  if (!s) throw new Error("APP_SECRET env var is not set");
  return s;
}

/** Deterministic session token derived from the app secret. */
export function sessionToken(): string {
  return createHmac("sha256", secret()).update("dbide-session-v1").digest("hex");
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const expected = sessionToken();
  if (token.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function checkPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD;
  if (!expected) throw new Error("APP_PASSWORD env var is not set");
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
