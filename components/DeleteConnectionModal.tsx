"use client";

import { useState } from "react";
import type { ConnectionMeta } from "@/lib/store";

interface Props {
  conn: ConnectionMeta;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export default function DeleteConnectionModal({ conn, onClose, onConfirm }: Props) {
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const match = typed === conn.name;

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!match || deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setDeleting(false);
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
        onSubmit={confirm}
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
        <div style={{ fontSize: 15, fontWeight: 600 }}>Delete connection</div>
        <div style={{ fontSize: 12.5, color: "var(--text-dim)", lineHeight: 1.5 }}>
          This permanently removes <b style={{ color: "var(--text)" }}>{conn.name}</b> and its saved
          credentials. The database itself is not touched.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.04em" }}>
            TYPE <b className="mono">{conn.name}</b> TO CONFIRM
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={conn.name}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-danger"
            disabled={!match || deleting}
            title={match ? undefined : "Type the connection name to enable"}
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </form>
    </div>
  );
}
