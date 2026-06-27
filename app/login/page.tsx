"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.replace("/");
    } else {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Login failed");
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh", background: "var(--bg0)" }}>
      <form
        onSubmit={submit}
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
        <div className="mono" style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.05em" }}>
          db<span style={{ color: "var(--accent)" }}>ide</span>
        </div>
        <div style={{ color: "var(--text-dim)", marginTop: -8 }}>Enter the workspace password.</div>
        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>}
        <button className="btn btn-accent" type="submit" disabled={busy || !password} style={{ justifyContent: "center" }}>
          {busy ? "Unlocking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
