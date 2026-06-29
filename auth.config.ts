import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe Auth.js config: providers + pure (DB-free) callbacks only, so it can
// be imported by `proxy.ts` (Edge runtime) without bundling `pg`. The DB-touching
// `jwt` callback lives in lib/auth.ts, which only Node code imports.

const allowedEmails = (process.env.AUTH_ALLOWED_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const allowedDomains = (process.env.AUTH_ALLOWED_DOMAIN ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
  .filter(Boolean);

/**
 * Allowlist gate. If neither AUTH_ALLOWED_EMAILS nor AUTH_ALLOWED_DOMAIN is set,
 * any Google account is accepted (convenient default — see .env.example warning).
 * Otherwise the email must match the email list or its domain must match.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  if (allowedEmails.length === 0 && allowedDomains.length === 0) return true;
  const e = email.toLowerCase();
  if (allowedEmails.includes(e)) return true;
  const domain = e.split("@")[1] ?? "";
  return allowedDomains.includes(domain);
}

export const authConfig = {
  providers: [Google], // reads AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET from env
  // Route the sign-in screen and all auth errors (e.g. AccessDenied) to our own
  // styled /login page instead of Auth.js's default unstyled pages.
  pages: { signIn: "/login", error: "/login" },
  // Reuse APP_SECRET (always present — it also encrypts stored credentials) so no
  // separate secret is required; AUTH_SECRET still wins if explicitly set.
  secret: process.env.AUTH_SECRET ?? process.env.APP_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ user }) {
      return isEmailAllowed(user.email);
    },
    session({ session, token }) {
      if (token.uid && session.user) session.user.id = token.uid as string;
      return session;
    },
    authorized({ auth }) {
      return !!auth?.user;
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
