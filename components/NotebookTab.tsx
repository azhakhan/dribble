"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useIde, type ConnectionMeta, type Tab } from "@/lib/store";
import type { PagedQueryResult } from "@/lib/drivers/types";
import SqlEditor from "./SqlEditor";
import ResultsPanel from "./ResultsPanel";
import DragHandle from "./DragHandle";
import { formatAge, isStale } from "@/lib/time";

interface Cell {
  id: string;
  sql: string;
}

const DEFAULT_RESULT_HEIGHT = 300;

// A persisted page of results for one cell.
interface CellSnapshot {
  result: PagedQueryResult | null;
  sql: string;
  page: number;
  limit: number;
  totalCount: number | null;
  ranAt: string;
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
  const notebookId = tab.resourceId!;
  const cellHeights = useIde((s) => s.layout.cellHeights[notebookId]);
  const setCellHeight = useIde((s) => s.setCellHeight);
  const [cells, setCells] = useState<Cell[] | null>(null);
  const [name, setName] = useState(tab.title);
  const [connectionId, setConnectionId] = useState<string | null>(
    tab.connectionId,
  );
  const [cellResults, setCellResults] = useState<
    Record<
      string,
      {
        result: PagedQueryResult | null;
        error: string | null;
        running: boolean;
        // pagination state for the query that produced `result`
        sql: string;
        page: number;
        limit: number;
        totalCount: number | null;
        // when the persisted snapshot was produced (null for a live, just-run result)
        ranAt: string | null;
      }
    >
  >({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatch = useRef<Record<string, unknown>>({});
  // Persisted result snapshots, kept in a ref so a single-cell run can save
  // without clobbering the other cells' snapshots.
  const snapshots = useRef<Record<string, CellSnapshot>>({});
  const dragStartHeight = useRef(0);

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
        // Rehydrate cached result snapshots produced the last time this ran.
        const saved: Record<string, CellSnapshot> =
          nb.results && typeof nb.results === "object" ? nb.results : {};
        snapshots.current = saved;
        const hydrated: typeof cellResults = {};
        for (const [cid, s] of Object.entries(saved)) {
          hydrated[cid] = {
            result: s.result,
            error: null,
            running: false,
            sql: s.sql,
            page: s.page,
            limit: s.limit,
            totalCount: s.totalCount,
            ranAt: s.ranAt,
          };
        }
        setCellResults(hydrated);
      }
    })();
  }, [tab.resourceId]);

  const persist = useCallback(
    (patch: { cells?: Cell[]; name?: string; connectionId?: string; results?: Record<string, CellSnapshot> }) => {
      // Merge patches so a SQL edit and a fresh result within the debounce
      // window don't overwrite each other.
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const body = pendingPatch.current;
        pendingPatch.current = {};
        fetch(`/api/notebooks/${tab.resourceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(() => {
          if (body.name) onRenamed();
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
      if (snapshots.current[id]) {
        delete snapshots.current[id];
        persist({ cells: final, results: snapshots.current });
      } else {
        persist({ cells: final });
      }
      return final;
    });
    setCellResults((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const DEFAULT_LIMIT = 100;

  // Run a cell from scratch: page 0, fresh count(*).
  function runCell(cell: Cell) {
    if (cellResults[cell.id]?.running) return;
    loadPage(cell.id, cell.sql, 0, cellResults[cell.id]?.limit ?? DEFAULT_LIMIT, true);
  }

  // Fetch a single page. `withCount` runs count(*) once (on Run); paging reuses it.
  async function loadPage(
    cellId: string,
    sql: string,
    page: number,
    limit: number,
    withCount: boolean,
  ) {
    if (!connectionId || !sql.trim()) return;
    setCellResults((prev) => ({
      ...prev,
      [cellId]: {
        result: prev[cellId]?.result ?? null,
        error: null,
        running: true,
        sql,
        page,
        limit,
        totalCount: withCount ? null : prev[cellId]?.totalCount ?? null,
        ranAt: prev[cellId]?.ranAt ?? null,
      },
    }));
    try {
      const res = await fetch(`/api/db/${connectionId}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sql, limit, offset: page * limit, count: withCount }),
      });
      const body = await res.json();
      if (res.ok) {
        const ranAt = new Date().toISOString();
        // On Run we counted; while paging we keep the count from the run.
        const totalCount: number | null = withCount
          ? body.totalCount
          : cellResults[cellId]?.totalCount ?? snapshots.current[cellId]?.totalCount ?? null;
        setCellResults((prev) => ({
          ...prev,
          [cellId]: { result: body, error: null, running: false, sql, page, limit, totalCount, ranAt },
        }));
        // Persist this page as the cell's snapshot for next time.
        snapshots.current = {
          ...snapshots.current,
          [cellId]: { result: body, sql, page, limit, totalCount, ranAt },
        };
        persist({ results: snapshots.current });
      } else {
        setCellResults((prev) => ({
          ...prev,
          [cellId]: {
            result: null,
            error: body.error ?? "Query failed",
            running: false,
            sql,
            page,
            limit,
            totalCount: null,
            ranAt: null,
          },
        }));
      }
    } catch (err) {
      setCellResults((prev) => ({
        ...prev,
        [cellId]: {
          result: null,
          error: err instanceof Error ? err.message : String(err),
          running: false,
          sql,
          page,
          limit,
          totalCount: null,
          ranAt: null,
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
          const resultHeight = cellHeights?.[cell.id] ?? DEFAULT_RESULT_HEIGHT;
          // A cached snapshot is stale if the SQL changed since, or it's old.
          const sqlChanged = !!cr?.ranAt && cr.sql !== cell.sql;
          const stale = !!cr?.ranAt && !cr.running && (sqlChanged || isStale(cr.ranAt));
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
                {cr?.ranAt && !cr.running && (
                  <span
                    className="mono"
                    style={{ fontSize: 10, color: stale ? "var(--accent)" : "var(--text-faint)" }}
                    title={stale ? (sqlChanged ? "SQL changed since this ran — re-run for fresh results" : "These results may be out of date — re-run for fresh results") : undefined}
                  >
                    {stale ? "⚠ stale · " : ""}ran {formatAge(cr.ranAt)}
                  </span>
                )}
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
                <>
                <div
                  style={{
                    borderTop: "1px solid var(--border-soft)",
                    height: resultHeight,
                    flexShrink: 0,
                  }}
                >
                  <ResultsPanel
                    result={cr.result}
                    error={cr.error}
                    running={cr.running}
                    emptyHint=""
                    serverPagination={
                      cr.result?.paged
                        ? {
                            page: cr.page,
                            limit: cr.limit,
                            totalCount: cr.totalCount,
                            onPage: (p) => loadPage(cell.id, cr.sql, p, cr.limit, false),
                            onLimit: (n) => loadPage(cell.id, cr.sql, 0, n, false),
                          }
                        : null
                    }
                  />
                </div>
                <DragHandle
                  orientation="horizontal"
                  onDragStart={() => {
                    dragStartHeight.current = resultHeight;
                  }}
                  onDrag={(dy) =>
                    setCellHeight(
                      notebookId,
                      cell.id,
                      Math.min(Math.max(dragStartHeight.current + dy, 120), 900),
                    )
                  }
                />
                </>
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
