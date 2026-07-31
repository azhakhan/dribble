"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Download } from "lucide-react";
import { useIde, type Tab } from "@/lib/store";
import type { TableDataResult } from "@/lib/drivers/types";
import { columnDisplayOrder } from "@/lib/columns";
import { toCsv } from "@/lib/csv";
import ResultsGrid from "./ResultsGrid";
import PaginationBar from "./PaginationBar";

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

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 0);
    return () => clearTimeout(timer);
  }, [load]);

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
          <button
            className="btn btn-ghost"
            style={{ padding: "3px 7px" }}
            title="Export CSV"
            disabled={!data || exporting}
            onClick={() => setExportOpen((v) => !v)}
          >
            <Download size={13} />
          </button>
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
        <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 13 }} title="Refresh" onClick={load}>
          ⟳
        </button>
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
          <button className="btn btn-ghost" style={{ padding: "1px 6px", fontSize: 11 }} onClick={() => setExportError(null)}>
            ✕
          </button>
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
          />
        ) : (
          <div style={{ display: "grid", placeItems: "center", width: "100%", color: "var(--text-faint)" }}>
            {loading ? "loading…" : ""}
          </div>
        )}
        {(loading || exporting) && data && (
          <div className="pulse mono" style={{ position: "absolute", top: 8, right: 16, color: "var(--accent)", fontSize: 11 }}>
            ● {exporting ? "exporting" : "loading"}
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
