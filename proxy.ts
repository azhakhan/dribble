import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

// Hosted (multi-user) mode is enabled purely by configuring Google OAuth.
const authEnabled = !!process.env.AUTH_GOOGLE_ID;

// Edge-safe instance built from the DB-free config (see auth.config.ts).
const { auth } = NextAuth(authConfig);

const PUBLIC_PREFIXES = ["/login", "/api/auth", "/_next"];
const isPublic = (pathname: string) =>
  PUBLIC_PREFIXES.some((p) => pathname.startsWith(p)) ||
  // Static assets in /public (logo.png, favicon.ico, etc.) — anything with a
  // file extension. Without this they'd be redirected to /login when signed out.
  /\.[a-zA-Z0-9]+$/.test(pathname);

// In local mode there is no login at all — every request passes through and is
// attributed to the sentinel user. In hosted mode, gate everything behind a
// valid Google session.
const gate = auth((req) => {
  const { pathname } = req.nextUrl;
  if (req.auth || isPublic(pathname)) return NextResponse.next();
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
});

export default authEnabled ? gate : () => NextResponse.next();

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
