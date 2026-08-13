"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Download, RefreshCw, X } from "lucide-react";
import { useIde, type Tab } from "@/lib/store";
import type { TableDataResult } from "@/lib/drivers/types";
import { columnDisplayOrder } from "@/lib/columns";
import { toCsv } from "@/lib/csv";
import ResultsGrid, { type GridEditing } from "./ResultsGrid";
import PaginationBar from "./PaginationBar";
import IconButton, { ICON_SIZE, SMALL_ICON_SIZE } from "./IconButton";
import Spinner from "./Spinner";

/** A staged (uncommitted) cell edit. `value: null` means "set to SQL NULL";
 *  `failed` carries the server's error after an unsuccessful save. */
interface StagedCell {
  value: string | null;
  failed?: string;
}

/** All staged cells of one row, plus the PK values that identify it. */
interface StagedRow {
  pk: Record<string, unknown>;
  cells: Record<string, StagedCell>;
}

const menuItem: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  width: "100%",
  padding: "5px 8px",
  fontSize: 12,
};

export default function TableTab({ tab }: { tab: Tab }) {
  // Every tab stays mounted (hidden ones are display:none), so a tab must not
  // query until it is actually on screen — otherwise a reload fires one query
  // per open tab and starves the one the user is looking at.
  const isActive = useIde((s) => s.activeTabId === tab.id);
  const columnWidths = useIde((s) => s.layout.columnWidths[tab.id]);
  const setColumnWidths = useIde((s) => s.setColumnWidths);
  const savedSort = useIde((s) => s.layout.tableSort[tab.id]);
  const setTableSort = useIde((s) => s.setTableSort);
  const columnOrder = useIde((s) => s.layout.columnOrder[tab.id]);
  const setColumnOrder = useIde((s) => s.setColumnOrder);
  const [data, setData] = useState<TableDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(100);
  const [sortColumn, setSortColumn] = useState<string | undefined>(savedSort?.column);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(savedSort?.dir ?? "asc");
  const [whereInput, setWhereInput] = useState("");
  const [where, setWhere] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const setDirty = useIde((s) => s.setDirty);
  /** Staged edits keyed by rowKey (JSON of the row's PK values) — stable across
   *  refetches, sorting, and paging. Session-only: lives in this component and
   *  dies with the tab. */
  const [edits, setEdits] = useState<Record<string, StagedRow>>({});
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; text: string } | null>(null);

  const pkIdxs = useMemo(
    () => (data ? data.columns.flatMap((c, i) => (c.isPrimaryKey ? [i] : [])) : []),
    [data],
  );

  /** Row identity: JSON of the row's PK values — stable across refetches,
   *  sorting, and paging. */
  const rowKey = useCallback((row: unknown[]) => JSON.stringify(pkIdxs.map((i) => row[i])), [pkIdxs]);

  const discard = useCallback(() => {
    setEdits({});
    setSaveResult(null);
  }, []);

  /** Revert one staged cell (DataGrip-style), removing the row entry if empty. */
  const revert = useCallback(
    (row: number, origColIdx: number) => {
      if (!data) return;
      const r = data.rows[row];
      if (!r) return;
      const key = rowKey(r);
      const colName = data.columns[origColIdx].name;
      setEdits((prev) => {
        const existing = prev[key];
        if (!existing?.cells[colName]) return prev;
        const cells = { ...existing.cells };
        delete cells[colName];
        const next = { ...prev };
        if (Object.keys(cells).length) next[key] = { ...existing, cells };
        else delete next[key];
        return next;
      });
    },
    [data, rowKey],
  );

  const stagedCount = useMemo(
    () => Object.values(edits).reduce((n, r) => n + Object.keys(r.cells).length, 0),
    [edits],
  );

  // Keep the tab-strip dirty registry in sync so closing a tab with staged
  // edits can prompt. Cleared on unmount (tab close).
  useEffect(() => {
    setDirty(tab.id, stagedCount);
    return () => setDirty(tab.id, 0);
  }, [stagedCount, tab.id, setDirty]);

  const gridEditing = useMemo<GridEditing | undefined>(() => {
    if (!data || !pkIdxs.length) return undefined;
    return {
      disabled: saving,
      getStaged: (row, origColIdx) => {
        const r = data.rows[row];
        if (!r) return undefined;
        return edits[rowKey(r)]?.cells[data.columns[origColIdx].name];
      },
      onEdit: (row, origColIdx, value) => {
        const r = data.rows[row];
        if (!r) return;
        const colName = data.columns[origColIdx].name;
        const key = rowKey(r);
        setEdits((prev) => {
          const existing = prev[key] ?? {
            pk: Object.fromEntries(pkIdxs.map((i) => [data.columns[i].name, r[i]])),
            cells: {},
          };
          // Editing back to the DB value unstages the cell.
          const orig = r[origColIdx];
          const origStr = orig === null || orig === undefined ? null : String(orig);
          const cells = { ...existing.cells };
          if (value === origStr) delete cells[colName];
          else cells[colName] = { value };
          const next = { ...prev };
          if (Object.keys(cells).length) next[key] = { ...existing, cells };
          else delete next[key];
          return next;
        });
      },
      revert,
      revertAll: discard,
    };
  }, [data, pkIdxs, edits, rowKey, revert, discard, saving]);

  /** Commit all staged rows: one UPDATE per row server-side; failures stay staged. */
  const save = async () => {
    if (!tab.connectionId || !tab.schema || !tab.table || saving) return;
    const entries = Object.entries(edits);
    if (!entries.length) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch(`/api/db/${tab.connectionId}/update-rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schema: tab.schema,
          table: tab.table,
          // Groups this save's per-row audit entries in the logs table.
          sessionId: crypto.randomUUID(),
          rows: entries.map(([, r]) => ({
            pk: r.pk,
            set: Object.fromEntries(Object.entries(r.cells).map(([c, cell]) => [c, cell.value])),
          })),
        }),
      });
      if (!res.ok) {
        setSaveResult({ ok: false, text: (await res.json().catch(() => ({})))?.error ?? "Save failed" });
        return;
      }
      const { updated, failed } = (await res.json()) as {
        updated: number;
        failed: { index: number; error: string }[];
      };
      const failedByIndex = new Map(failed.map((f) => [f.index, f.error]));
      setEdits((current) => {
        const next = { ...current };
        entries.forEach(([key, savedRow], i) => {
          const currentRow = next[key];
          if (!currentRow) return;
          const err = failedByIndex.get(i);
          const cells = { ...currentRow.cells };
          for (const [col, savedCell] of Object.entries(savedRow.cells)) {
            const currentCell = cells[col];
            // A newer edit must survive completion of this older save request.
            if (!currentCell || currentCell.value !== savedCell.value) continue;
            if (err === undefined) delete cells[col];
            else cells[col] = { ...currentCell, failed: err };
          }
          if (Object.keys(cells).length) next[key] = { ...currentRow, cells };
          else delete next[key];
        });
        return next;
      });
      setSaveResult({
        ok: failed.length === 0,
        text: failed.length
          ? `${updated} row${updated === 1 ? "" : "s"} updated; ${failed.length} failed — ${failed[0].error}`
          : `${updated} row${updated === 1 ? "" : "s"} updated (${stagedCount} cell${stagedCount === 1 ? "" : "s"})`,
      });
      // Refetch so triggers/defaults and concurrent changes show. Failed edits
      // survive — they're keyed by PK, not row position.
      await load();
    } catch (err) {
      setSaveResult({ ok: false, text: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const load = useCallback(async () => {
    if (!tab.connectionId || !tab.schema || !tab.table) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      schema: tab.schema,
      table: tab.table,
      limit: String(limit),
      offset: String(page * limit),
    });
    if (sortColumn) {
      params.set("sortColumn", sortColumn);
      params.set("sortDir", sortDir);
    }
    if (where) params.set("where", where);
    const res = await fetch(`/api/db/${tab.connectionId}/table-data?${params}`);
    if (res.ok) {
      setData(await res.json());
    } else {
      setError((await res.json().catch(() => ({})))?.error ?? "Failed to load");
    }
    setLoading(false);
  }, [tab.connectionId, tab.schema, tab.table, page, limit, sortColumn, sortDir, where]);

  // Identifies the query the current controls describe. `load` is rebuilt from
  // exactly these inputs, so the key changes iff the data would.
  const queryKey = JSON.stringify([
    tab.connectionId, tab.schema, tab.table, page, limit, sortColumn, sortDir, where,
  ]);
  const loadedKey = useRef<string | null>(null);

  // Load when this tab is on screen and what it shows is out of date. Switching
  // away and back is free — the key still matches, so the cached rows stand.
  useEffect(() => {
    if (!isActive || loadedKey.current === queryKey) return;
    const timer = setTimeout(() => {
      loadedKey.current = queryKey;
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [isActive, queryKey, load]);

  // Close the export menu on an outside click.
  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [exportOpen]);

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  /** Export exactly what the grid shows — current page, current column order. */
  const exportCurrentView = () => {
    if (!data) return;
    setExportOpen(false);
    const order = columnDisplayOrder(data.columns.map((c) => c.name), columnOrder);
    const csv = toCsv(
      order.map((i) => data.columns[i].name),
      data.rows.map((row) => order.map((i) => row[i])),
    );
    download(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
      `${tab.schema}.${tab.table}_page${page + 1}.csv`,
    );
  };

  /** Export every row the current filter and sort produce, not just this page. */
  const exportAll = async () => {
    if (!tab.connectionId || !tab.schema || !tab.table) return;
    setExportOpen(false);
    setExporting(true);
    setExportError(null);
    try {
      const params = new URLSearchParams({ schema: tab.schema, table: tab.table });
      if (sortColumn) {
        params.set("sortColumn", sortColumn);
        params.set("sortDir", sortDir);
      }
      if (where) params.set("where", where);
      if (data) {
        for (const i of columnDisplayOrder(data.columns.map((c) => c.name), columnOrder)) {
          params.append("col", data.columns[i].name);
        }
      }
      const res = await fetch(`/api/db/${tab.connectionId}/export?${params}`);
      if (!res.ok) {
        setExportError((await res.json().catch(() => ({})))?.error ?? "Export failed");
        return;
      }
      download(await res.blob(), `${tab.schema}.${tab.table}.csv`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const onHeaderClick = (col: string) => {
    if (sortColumn === col) {
      if (sortDir === "asc") {
        setSortDir("desc");
        setTableSort(tab.id, { column: col, dir: "desc" });
      } else {
        setSortColumn(undefined);
        setSortDir("asc");
        setTableSort(tab.id, null);
      }
    } else {
      setSortColumn(col);
      setSortDir("asc");
      setTableSort(tab.id, { column: col, dir: "asc" });
    }
    setPage(0);
  };

  const totalPages = data?.totalCount != null ? Math.max(1, Math.ceil(data.totalCount / limit)) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--bg1)",
          flexShrink: 0,
        }}
      >
        <span className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>
          {tab.schema}.{tab.table}
        </span>
        <span className="mono" style={{ color: "var(--text-faint)", fontSize: 11 }}>
          WHERE
        </span>
        <input
          className="mono"
          style={{ flex: 1, fontSize: 12, padding: "3px 8px" }}
          placeholder="e.g. status = 'active' AND created_at > now() - interval '7 days'"
          value={whereInput}
          onChange={(e) => setWhereInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              setWhere(whereInput.trim());
              setPage(0);
            }
          }}
        />
        <button
          className="btn"
          style={{ padding: "3px 10px", fontSize: 12 }}
          onClick={() => {
            setWhere(whereInput.trim());
            setPage(0);
          }}
        >
          Apply
        </button>
        <div ref={exportRef} style={{ position: "relative", display: "flex" }}>
          {stagedCount > 0 && (
            <div style={{ display: "flex", gap: 6, marginRight: 6 }}>
              <button
                className="btn btn-ghost"
                style={{ padding: "3px 10px", fontSize: 12 }}
                disabled={saving}
                onClick={discard}
              >
                Discard
              </button>
              <button
                className="btn btn-accent"
                style={{ padding: "3px 10px", fontSize: 12 }}
                disabled={saving}
                onClick={save}
              >
                {saving ? "Saving…" : `Save ${stagedCount}`}
              </button>
            </div>
          )}
          <IconButton
            icon={<Download size={ICON_SIZE} />}
            title="Export CSV"
            disabled={!data || exporting}
            onClick={() => setExportOpen((v) => !v)}
          />
          {exportOpen && data && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                zIndex: 20,
                minWidth: 230,
                padding: 4,
                borderRadius: 4,
                border: "1px solid var(--border)",
                background: "var(--bg2)",
                boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              }}
            >
              <div
                className="mono"
                style={{ padding: "4px 8px 6px", fontSize: 10, color: "var(--text-faint)" }}
              >
                EXPORT CSV{where ? " · filter applied" : ""}
              </div>
              <button className="btn btn-ghost" style={menuItem} onClick={exportCurrentView}>
                <span>Current view</span>
                <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
                  {data.rows.length.toLocaleString()} rows
                </span>
              </button>
              <button className="btn btn-ghost" style={menuItem} onClick={exportAll}>
                <span>All data</span>
                <span style={{ color: "var(--text-faint)", fontSize: 11 }}>
                  {data.totalCount != null ? `${data.totalCount.toLocaleString()} rows` : "all pages"}
                </span>
              </button>
            </div>
          )}
        </div>
        <IconButton icon={<RefreshCw size={ICON_SIZE} />} title="Refresh" onClick={load} />
      </div>

      {exportError && (
        <div
          className="mono"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg1)",
            color: "var(--danger)",
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1 }}>export failed: {exportError}</span>
          <IconButton icon={<X size={ICON_SIZE} />} title="Dismiss" onClick={() => setExportError(null)} />
        </div>
      )}

      {saveResult && (
        <div
          className="mono"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 10px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg1)",
            color: saveResult.ok ? "var(--green)" : "var(--danger)",
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          <span style={{ flex: 1 }}>{saveResult.text}</span>
          <IconButton icon={<X size={ICON_SIZE} />} title="Dismiss" onClick={() => setSaveResult(null)} />
        </div>
      )}

      {/* grid */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        {error ? (
          <pre className="mono" style={{ margin: 0, padding: 16, color: "var(--danger)", fontSize: 12, whiteSpace: "pre-wrap", overflow: "auto", width: "100%" }}>
            {error}
          </pre>
        ) : data ? (
          <ResultsGrid
            result={data}
            sortColumn={sortColumn}
            sortDir={sortDir}
            onHeaderClick={onHeaderClick}
            columnWidths={columnWidths ?? {}}
            onColumnWidthsChange={(w) => setColumnWidths(tab.id, w)}
            columnOrder={columnOrder}
            onColumnOrderChange={(o) => setColumnOrder(tab.id, o)}
            editing={gridEditing}
          />
        ) : (
          <div style={{ display: "grid", placeItems: "center", width: "100%", color: "var(--text-faint)" }}>
            {loading ? "loading…" : ""}
          </div>
        )}
        {(loading || exporting) && data && (
          <div className="mono" style={{ position: "absolute", top: 8, right: 16, display: "flex", alignItems: "center", gap: 5, color: "var(--accent)", fontSize: 11 }}>
            <Spinner size={SMALL_ICON_SIZE} /> {exporting ? "exporting" : "loading"}
          </div>
        )}
      </div>

      <PaginationBar
        page={page}
        totalPages={totalPages}
        limit={limit}
        totalCount={data?.totalCount}
        rowsOnPage={data?.rows.length ?? 0}
        onPage={setPage}
        onLimit={(n) => { setLimit(n); setPage(0); }}
      />
    </div>
  );
}
