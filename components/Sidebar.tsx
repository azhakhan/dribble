"use client";

import { useRef, useState } from "react";
import { useIde, type ChatMeta, type ConnectionMeta, type NotebookMeta } from "@/lib/store";
import ConnectionModal from "./ConnectionModal";

interface Props {
  connections: ConnectionMeta[];
  notebooks: NotebookMeta[];
  chats: ChatMeta[];
  refreshConnections: () => void;
  refreshNotebooks: () => void;
  refreshChats: () => void;
}

const SECTION: React.CSSProperties = {
  padding: "8px 10px 4px",
  fontSize: 10,
  letterSpacing: "0.12em",
  color: "var(--text-faint)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        fontSize: 9,
        color: "var(--text-faint)",
        transform: open ? "rotate(90deg)" : "none",
        transition: "transform 0.12s",
      }}
    >
      ▶
    </span>
  );
}

function TableNode({
  conn,
  schema,
  table,
  kind,
  selected,
  onSelect,
}: {
  conn: ConnectionMeta;
  schema: string;
  table: string;
  kind: "table" | "view";
  selected: boolean;
  onSelect: () => void;
}) {
  const openTab = useIde((s) => s.openTab);
  return (
    <button
      className={`tree-row ${selected ? "selected" : ""}`}
      style={{ paddingLeft: 40 }}
      onClick={onSelect}
      onDoubleClick={() =>
        openTab({
          id: `table:${conn.id}:${schema}.${table}`,
          kind: "table",
          title: table,
          connectionId: conn.id,
          schema,
          table,
        })
      }
      title={`${schema}.${table}`}
    >
      <span className="mono" style={{ fontSize: 10, color: kind === "view" ? "#b48ead" : "var(--teal)" }}>
        {kind === "view" ? "◇" : "▦"}
      </span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{table}</span>
    </button>
  );
}

function SchemaNode({ conn, schema, selectedKey, setSelectedKey }: { conn: ConnectionMeta; schema: string; selectedKey: string; setSelectedKey: (k: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tables, setTables] = useState<{ name: string; kind: "table" | "view" }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `schema:${conn.id}:${schema}`;

  async function toggle() {
    setSelectedKey(key);
    const next = !open;
    setOpen(next);
    if (next && tables === null) {
      const res = await fetch(`/api/db/${conn.id}/tables?schema=${encodeURIComponent(schema)}`);
      if (res.ok) setTables(await res.json());
      else setError((await res.json().catch(() => ({})))?.error ?? "failed");
    }
  }

  return (
    <div>
      <button className={`tree-row ${selectedKey === key ? "selected" : ""}`} style={{ paddingLeft: 24 }} onClick={toggle}>
        <Chevron open={open} />
        <span style={{ color: "var(--accent-dim)" }}>◆</span>
        <span>{schema}</span>
      </button>
      {open && error && <div style={{ paddingLeft: 40, color: "var(--danger)", fontSize: 11 }}>{error}</div>}
      {open && tables === null && !error && <div style={{ paddingLeft: 40, color: "var(--text-faint)" }}>loading…</div>}
      {open &&
        tables?.map((t) => (
          <TableNode
            key={t.name}
            conn={conn}
            schema={schema}
            table={t.name}
            kind={t.kind}
            selected={selectedKey === `table:${conn.id}:${schema}.${t.name}`}
            onSelect={() => setSelectedKey(`table:${conn.id}:${schema}.${t.name}`)}
          />
        ))}
      {open && tables?.length === 0 && <div style={{ paddingLeft: 40, color: "var(--text-faint)" }}>no tables</div>}
    </div>
  );
}

function ConnectionNode({
  conn,
  selectedKey,
  setSelectedKey,
  onDelete,
}: {
  conn: ConnectionMeta;
  selectedKey: string;
  setSelectedKey: (k: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [schemas, setSchemas] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = `conn:${conn.id}`;

  async function toggle() {
    setSelectedKey(key);
    const next = !open;
    setOpen(next);
    if (next && schemas === null) {
      setError(null);
      const res = await fetch(`/api/db/${conn.id}/schemas`);
      if (res.ok) setSchemas(await res.json());
      else setError((await res.json().catch(() => ({})))?.error ?? "connection failed");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", position: "relative" }} className="conn-row">
        <button className={`tree-row ${selectedKey === key ? "selected" : ""}`} onClick={toggle} title={`${conn.host}:${conn.port}/${conn.database}`}>
          <Chevron open={open} />
          <span style={{ color: open ? "var(--green)" : "var(--text-faint)" }}>●</span>
          <span style={{ fontWeight: 500 }}>{conn.name}</span>
          <span className="mono" style={{ fontSize: 10, color: "var(--text-faint)", marginLeft: 2 }}>
            {conn.database}
          </span>
        </button>
        <button
          className="btn-ghost"
          style={{ position: "absolute", right: 4, fontSize: 11, padding: "1px 5px", borderRadius: 3 }}
          title="Remove connection"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Remove connection "${conn.name}"?`)) onDelete();
          }}
        >
          ×
        </button>
      </div>
      {open && error && (
        <div style={{ paddingLeft: 24, color: "var(--danger)", fontSize: 11, whiteSpace: "pre-wrap", padding: "2px 8px 2px 24px" }}>{error}</div>
      )}
      {open && schemas === null && !error && <div style={{ paddingLeft: 24, color: "var(--text-faint)" }}>connecting…</div>}
      {open && schemas?.map((s) => <SchemaNode key={s} conn={conn} schema={s} selectedKey={selectedKey} setSelectedKey={setSelectedKey} />)}
    </div>
  );
}

function ResourceNode({
  item,
  kind,
  icon,
  color,
  onOpen,
  onDelete,
  onRename,
}: {
  item: NotebookMeta | ChatMeta;
  kind: "query" | "chat";
  icon: string;
  color: string;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRenameRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.name);

  function startEditing() {
    cancelRenameRef.current = false;
    setDraft(item.name);
    setEditing(true);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }

  async function commitRename() {
    if (cancelRenameRef.current) {
      cancelRenameRef.current = false;
      setDraft(item.name);
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (!next || next === item.name) {
      setDraft(item.name);
      return;
    }
    await onRename(next);
  }

  if (editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", padding: "1px 4px 1px 8px" }}>
        <span className="mono" style={{ width: 17, fontSize: 10, color }}>
          {icon}
        </span>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              cancelRenameRef.current = true;
              setDraft(item.name);
              setEditing(false);
            }
          }}
          aria-label={`Rename ${kind}`}
          style={{ flex: 1, minWidth: 0, fontSize: 12, padding: "2px 5px" }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative" }}>
      <button className="tree-row" onClick={onOpen} onDoubleClick={startEditing} title={item.name}>
        <span className="mono" style={{ fontSize: 10, color }}>
          {icon}
        </span>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.name}</span>
      </button>
      <span style={{ position: "absolute", right: 4, display: "flex", gap: 1, background: "var(--bg1)" }}>
        <button className="btn-ghost" style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3 }} onClick={startEditing} title="Rename">
          ✎
        </button>
        <button className="btn-ghost" style={{ fontSize: 11, padding: "1px 5px", borderRadius: 3 }} onClick={onDelete} title="Delete">
          ×
        </button>
      </span>
    </div>
  );
}

export default function Sidebar({ connections, notebooks, chats, refreshConnections, refreshNotebooks, refreshChats }: Props) {
  const openTab = useIde((s) => s.openTab);
  const closeTab = useIde((s) => s.closeTab);
  const renameTab = useIde((s) => s.renameTab);
  const [selectedKey, setSelectedKey] = useState("");
  const [showModal, setShowModal] = useState(false);

  const defaultConnection = (): string | null => {
    const m = selectedKey.match(/^(?:conn|schema|table):([^:]+)/);
    return m?.[1] ?? connections[0]?.id ?? null;
  };

  async function newNotebook() {
    const res = await fetch("/api/notebooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: defaultConnection() }),
    });
    if (res.ok) {
      const nb = await res.json();
      refreshNotebooks();
      openTab({ id: `notebook:${nb.id}`, kind: "notebook", title: nb.name, connectionId: nb.connection_id, resourceId: nb.id });
    }
  }

  async function newChat() {
    const res = await fetch("/api/chats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: defaultConnection() }),
    });
    if (res.ok) {
      const chat = await res.json();
      refreshChats();
      openTab({ id: `chat:${chat.id}`, kind: "chat", title: chat.name, connectionId: chat.connection_id, resourceId: chat.id });
    }
  }

  async function deleteResource(kind: "notebooks" | "chats", id: string) {
    await fetch(`/api/${kind}/${id}`, { method: "DELETE" });
    closeTab(`${kind === "notebooks" ? "notebook" : "chat"}:${id}`);
    if (kind === "notebooks") refreshNotebooks();
    else refreshChats();
  }

  async function renameResource(kind: "notebooks" | "chats", id: string, name: string) {
    const res = await fetch(`/api/${kind}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    renameTab(`${kind === "notebooks" ? "notebook" : "chat"}:${id}`, name);
    if (kind === "notebooks") refreshNotebooks();
    else refreshChats();
  }

  return (
    <div
      style={{
        width: 280,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--bg1)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div style={{ ...SECTION, paddingTop: 10 }}>
        <span>DATABASES</span>
        <button className="btn-ghost" style={{ fontSize: 14, padding: "0 6px", borderRadius: 3 }} title="Add connection" onClick={() => setShowModal(true)}>
          +
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: "1 1 50%", padding: "0 4px" }}>
        {connections.length === 0 && (
          <div style={{ padding: "8px 10px", color: "var(--text-faint)" }}>
            No connections yet.{" "}
            <button style={{ color: "var(--accent)", textDecoration: "underline" }} onClick={() => setShowModal(true)}>
              Add one
            </button>
          </div>
        )}
        {connections.map((c) => (
          <ConnectionNode
            key={c.id}
            conn={c}
            selectedKey={selectedKey}
            setSelectedKey={setSelectedKey}
            onDelete={async () => {
              await fetch(`/api/connections/${c.id}`, { method: "DELETE" });
              refreshConnections();
            }}
          />
        ))}
      </div>

      <div style={SECTION}>
        <span>QUERIES</span>
        <button className="btn-ghost" style={{ fontSize: 14, padding: "0 6px", borderRadius: 3 }} title="New query notebook" onClick={newNotebook}>
          +
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: "0 1 25%", padding: "0 4px" }}>
        {notebooks.map((nb) => (
          <ResourceNode
            key={nb.id}
            item={nb}
            kind="query"
            icon="❯_"
            color="var(--accent)"
            onOpen={() => openTab({ id: `notebook:${nb.id}`, kind: "notebook", title: nb.name, connectionId: nb.connection_id, resourceId: nb.id })}
            onDelete={() => deleteResource("notebooks", nb.id)}
            onRename={(name) => renameResource("notebooks", nb.id, name)}
          />
        ))}
      </div>

      <div style={SECTION}>
        <span>CHATS</span>
        <button className="btn-ghost" style={{ fontSize: 14, padding: "0 6px", borderRadius: 3 }} title="New chat" onClick={newChat}>
          +
        </button>
      </div>
      <div style={{ overflowY: "auto", flex: "0 1 25%", padding: "0 4px", paddingBottom: 8 }}>
        {chats.map((chat) => (
          <ResourceNode
            key={chat.id}
            item={chat}
            kind="chat"
            icon="✦"
            color="#b48ead"
            onOpen={() => openTab({ id: `chat:${chat.id}`, kind: "chat", title: chat.name, connectionId: chat.connection_id, resourceId: chat.id })}
            onDelete={() => deleteResource("chats", chat.id)}
            onRename={(name) => renameResource("chats", chat.id, name)}
          />
        ))}
      </div>

      {showModal && <ConnectionModal onClose={() => setShowModal(false)} onSaved={refreshConnections} />}
    </div>
  );
}
