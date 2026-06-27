"use client";

import { useState } from "react";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

const FIELD: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4 };
const LABEL: React.CSSProperties = { fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.04em" };

export default function ConnectionModal({ onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    name: "",
    type: "postgres",
    host: "",
    port: 5432,
    database: "",
    username: "",
    password: "",
    ssl: true,
  });
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function test() {
    setTestState("testing");
    setError(null);
    const res = await fetch("/api/connections/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setTestState("ok");
    } else {
      setTestState("fail");
      setError((await res.json().catch(() => ({})))?.error ?? "Connection failed");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      setError((await res.json().catch(() => ({})))?.error ?? "Failed to save");
      setSaving(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,9,12,0.7)",
        display: "grid",
        placeItems: "center",
        zIndex: 100,
      }}
    >
      <form
        className="fadeup"
        onClick={(e) => e.stopPropagation()}
        onSubmit={save}
        style={{
          width: 420,
          background: "var(--bg1)",
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600 }}>New connection</div>

        <div style={FIELD}>
          <span style={LABEL}>NAME</span>
          <input autoFocus required value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="production" />
        </div>

        <div style={FIELD}>
          <span style={LABEL}>TYPE</span>
          <select value={form.type} onChange={(e) => set("type", e.target.value)}>
            <option value="postgres">PostgreSQL</option>
            <option value="mysql" disabled>MySQL (soon)</option>
            <option value="snowflake" disabled>Snowflake (soon)</option>
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 10 }}>
          <div style={FIELD}>
            <span style={LABEL}>HOST</span>
            <input required value={form.host} onChange={(e) => set("host", e.target.value)} placeholder="db.example.com" />
          </div>
          <div style={FIELD}>
            <span style={LABEL}>PORT</span>
            <input type="number" value={form.port} onChange={(e) => set("port", Number(e.target.value))} />
          </div>
        </div>

        <div style={FIELD}>
          <span style={LABEL}>DATABASE</span>
          <input required value={form.database} onChange={(e) => set("database", e.target.value)} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={FIELD}>
            <span style={LABEL}>USER</span>
            <input required value={form.username} onChange={(e) => set("username", e.target.value)} />
          </div>
          <div style={FIELD}>
            <span style={LABEL}>PASSWORD</span>
            <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-dim)" }}>
          <input type="checkbox" checked={form.ssl} onChange={(e) => set("ssl", e.target.checked)} style={{ width: "auto" }} />
          Use SSL
        </label>

        {error && <div style={{ color: "var(--danger)", fontSize: 12, whiteSpace: "pre-wrap" }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn" onClick={test} disabled={testState === "testing"}>
            {testState === "testing" ? "Testing…" : testState === "ok" ? "✓ Connected" : "Test"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-accent" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}
