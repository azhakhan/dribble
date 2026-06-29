"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";

type SessionUser = { name?: string | null; email?: string | null; image?: string | null };

/**
 * Shows the signed-in user + a sign-out control. Reads the Auth.js session
 * endpoint directly, so in local mode (no session) it renders nothing — no
 * auth-mode flag needs to be threaded through to the client.
 */
export default function UserMenu() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => alive && setUser(s?.user ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!user) return null;

  return (
    <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ color: "var(--text-faint)", fontSize: 11 }}>{user.email ?? user.name}</span>
      <button
        className="btn-ghost"
        style={{ fontSize: 12 }}
        onClick={() => signOut({ callbackUrl: "/login" })}
      >
        Sign out
      </button>
    </div>
  );
}
