"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIde, type ConnectionMeta, type Tab } from "@/lib/store";
import type { QueryResult } from "@/lib/drivers/types";
import SqlEditor from "./SqlEditor";
import ResultsPanel from "./ResultsPanel";

interface Cell {
  id: string;
  sql: string;
}

export default function NotebookTab({
  tab,
  connections,
  onRenamed,
}: {
  tab: Tab;
  connections: ConnectionMeta[];
  onRenamed: () => void;
}) {
  const renameTab = useIde((s) => s.renameTab);
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [name, setName] = useState(tab.title);
  const [connectionId, setConnectionId] = useState<string | null>(
    tab.connectionId,
  );
  const [cellResults, setCellResults] = useState<
    Record<
      string,
      { result: QueryResult | null; error: string | null; running: boolean }
    >
  >({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/notebooks/${tab.resourceId}`);
      if (res.ok) {
        const nb = await res.json();
        setCells(
          Array.isArray(nb.cells) && nb.cells.length
            ? nb.cells
            : [{ id: crypto.randomUUID(), sql: "" }],
        );
        setName(nb.name);
        setConnectionId(nb.connection_id);
      }
    })();
  }, [tab.resourceId]);

  const persist = useCallback(
    (patch: { cells?: Cell[]; name?: string; connectionId?: string }) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        fetch(`/api/notebooks/${tab.resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }).then(() => {
          if (patch.name) onRenamed();
        });
      }, 600);
    },
    [tab.resourceId, onRenamed],
  );

  const updateCell = (id: string, sql: string) => {
    setCells((prev) => {
      const next = prev!.map((c) => (c.id === id ? { ...c, sql } : c));
      persist({ cells: next });
      return next;
    });
  };

  const addCell = (afterId?: string) => {
    setCells((prev) => {
      const next = [...prev!];
      const idx = afterId
        ? next.findIndex((c) => c.id === afterId) + 1
        : next.length;
      next.splice(idx, 0, { id: crypto.randomUUID(), sql: "" });
      persist({ cells: next });
      return next;
    });
  };

  const removeCell = (id: string) => {
    setCells((prev) => {
      const next = prev!.filter((c) => c.id !== id);
      const final = next.length ? next : [{ id: crypto.randomUUID(), sql: "" }];
      persist({ cells: final });
      return final;
    });
  };

  async function runCell(cell: Cell) {
    if (!connectionId || !cell.sql.trim() || cellResults[cell.id]?.running)
      return;
    setCellResults((prev) => ({
      ...prev,
      [cell.id]: { result: null, error: null, running: true },
    }));
    try {
      const res = await fetch(`/api/db/${connectionId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql: cell.sql }),
      });
      const body = await res.json();
      if (res.ok) {
        setCellResults((prev) => ({
          ...prev,
          [cell.id]: { result: body, error: null, running: false },
        }));
      } else {
        setCellResults((prev) => ({
          ...prev,
          [cell.id]: {
            result: null,
            error: body.error ?? "Query failed",
            running: false,
          },
        }));
      }
    } catch (err) {
      setCellResults((prev) => ({
        ...prev,
        [cell.id]: {
          result: null,
          error: err instanceof Error ? err.message : String(err),
          running: false,
        },
      }));
    }
  }

  if (cells === null) {
    return (
      <div
        style={{
          display: "grid",
          placeItems: "center",
          height: "100%",
          color: "var(--text-faint)",
        }}
      >
        loading…
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg1)",
          flexShrink: 0,
        }}
      >
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            renameTab(tab.id, e.target.value);
            persist({ name: e.target.value });
          }}
          style={{
            border: "none",
            background: "transparent",
            fontWeight: 600,
            fontSize: 13,
            padding: "2px 4px",
            width: 220,
          }}
        />
        <select
          value={connectionId ?? ""}
          onChange={(e) => {
            setConnectionId(e.target.value || null);
            persist({ connectionId: e.target.value });
          }}
          style={{ fontSize: 12, padding: "2px 6px", marginLeft: "auto" }}
        >
          <option value="" disabled>
            connection…
          </option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.database}
            </option>
          ))}
        </select>
      </div>

      {/* cells */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {cells.map((cell, i) => {
          const lines = Math.max(cell.sql.split("\n").length, 2);
          const height = Math.min(Math.max(lines * 19 + 18, 60), 360);
          const cr = cellResults[cell.id];
          return (
            <div key={cell.id} className="cell-card fadeup" style={{ flexShrink: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 8px",
                  borderBottom: "1px solid var(--border-soft)",
                  background: "var(--bg2)",
                }}
              >
                <button
                  className="btn"
                  style={{
                    padding: "1px 10px",
                    fontSize: 11,
                    color: cr?.running ? "var(--accent)" : "var(--green)",
                  }}
                  onClick={() => runCell(cell)}
                  disabled={!!cr?.running || !connectionId}
                  title="Run (⌘↩)"
                >
                  {cr?.running ? "…" : "▶ Run"}
                </button>
                <span
                  className="mono"
                  style={{ fontSize: 10, color: "var(--text-faint)" }}
                >
                  [{i + 1}]
                </span>
                <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 11, padding: "1px 6px" }}
                    title="Add cell below"
                    onClick={() => addCell(cell.id)}
                  >
                    +
                  </button>
                  <button
                    className="btn-ghost"
                    style={{ fontSize: 11, padding: "1px 6px" }}
                    title="Delete cell"
                    onClick={() => removeCell(cell.id)}
                  >
                    ×
                  </button>
                </span>
              </div>
              <SqlEditor
                value={cell.sql}
                onChange={(v) => updateCell(cell.id, v)}
                onRun={() =>
                  runCell({ ...cell, sql: cellSqlRefValue(cells, cell.id) })
                }
                height={height}
              />
              {cr && (
                <div
                  style={{
                    borderTop: "1px solid var(--border-soft)",
                    height: 300,
                    flexShrink: 0,
                  }}
                >
                  <ResultsPanel
                    result={cr.result}
                    error={cr.error}
                    running={cr.running}
                    emptyHint=""
                  />
                </div>
              )}
            </div>
          );
        })}
        <button
          className="btn btn-ghost"
          style={{ alignSelf: "center", fontSize: 12 }}
          onClick={() => addCell()}
        >
          + Add cell
        </button>
      </div>
    </div>
  );
}

// Read the latest SQL for a cell (the closure in onRun may hold a stale cell).
function cellSqlRefValue(cells: Cell[], id: string): string {
  return cells.find((c) => c.id === id)?.sql ?? "";
}
