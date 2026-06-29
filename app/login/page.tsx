"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// Auth.js redirects failed sign-ins here with ?error=<code> (see auth.config.ts).
function errorMessage(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "AccessDenied":
      return "This account isn't allowed to sign in.";
    case "Configuration":
      return "Sign-in is misconfigured. Check the server setup.";
    default:
      return "Something went wrong signing in. Please try again.";
  }
}

function LoginCard() {
  const [busy, setBusy] = useState(false);
  const error = errorMessage(useSearchParams().get("error"));

  return (
    <div
      className="fadeup"
      style={{
        width: 340,
        padding: "36px 32px",
        background: "var(--bg1)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <Image src="/logo.png" alt="Logo" width={40} height={40} unoptimized style={{ display: "block" }} />
      <div style={{ color: "var(--text-dim)" }}>Sign in to continue.</div>
      {error && <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>}
      <button
        className="btn btn-accent"
        onClick={() => {
          setBusy(true);
          signIn("google", { callbackUrl: "/" });
        }}
        disabled={busy}
        style={{ justifyContent: "center" }}
      >
        {busy ? "Redirecting…" : "Sign in with Google"}
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "var(--bg0)" }}>
      <Suspense>
        <LoginCard />
      </Suspense>
    </div>
  );
}
