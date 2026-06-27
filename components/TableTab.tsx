"use client";

import { useCallback, useEffect, useState } from "react";
import type { Tab } from "@/lib/store";
import type { TableDataResult } from "@/lib/drivers/types";
import ResultsGrid from "./ResultsGrid";

export default function TableTab({ tab }: { tab: Tab }) {
  const [data, setData] = useState<TableDataResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(100);
  const [sortColumn, setSortColumn] = useState<string | undefined>();
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [whereInput, setWhereInput] = useState("");
  const [where, setWhere] = useState("");

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

  const onHeaderClick = (col: string) => {
    if (sortColumn === col) {
      if (sortDir === "asc") setSortDir("desc");
      else {
        setSortColumn(undefined);
        setSortDir("asc");
      }
    } else {
      setSortColumn(col);
      setSortDir("asc");
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
        <button className="btn btn-ghost" style={{ padding: "3px 8px", fontSize: 13 }} title="Refresh" onClick={load}>
          ⟳
        </button>
      </div>

      {/* grid */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative" }}>
        {error ? (
          <pre className="mono" style={{ margin: 0, padding: 16, color: "var(--danger)", fontSize: 12, whiteSpace: "pre-wrap", overflow: "auto", width: "100%" }}>
            {error}
          </pre>
        ) : data ? (
          <ResultsGrid result={data} sortColumn={sortColumn} sortDir={sortDir} onHeaderClick={onHeaderClick} />
        ) : (
          <div style={{ display: "grid", placeItems: "center", width: "100%", color: "var(--text-faint)" }}>
            {loading ? "loading…" : ""}
          </div>
        )}
        {loading && data && (
          <div className="pulse mono" style={{ position: "absolute", top: 8, right: 16, color: "var(--accent)", fontSize: 11 }}>
            ● loading
          </div>
        )}
      </div>

      {/* pagination */}
      <div
        className="mono"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "4px 10px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg1)",
          fontSize: 11,
          color: "var(--text-dim)",
          flexShrink: 0,
        }}
      >
        <button className="btn-ghost" style={{ padding: "1px 8px" }} disabled={page === 0} onClick={() => setPage(0)}>
          «
        </button>
        <button className="btn-ghost" style={{ padding: "1px 8px" }} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
          ‹
        </button>
        <span>
          page {page + 1}
          {totalPages != null ? ` / ${totalPages}` : ""}
        </span>
        <button
          className="btn-ghost"
          style={{ padding: "1px 8px" }}
          disabled={totalPages != null ? page + 1 >= totalPages : (data?.rows.length ?? 0) < limit}
          onClick={() => setPage((p) => p + 1)}
        >
          ›
        </button>
        {totalPages != null && (
          <button className="btn-ghost" style={{ padding: "1px 8px" }} disabled={page + 1 >= totalPages} onClick={() => setPage(totalPages - 1)}>
            »
          </button>
        )}
        <span style={{ marginLeft: "auto" }}>{data?.totalCount != null ? `${data.totalCount.toLocaleString()} rows` : ""}</span>
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value));
            setPage(0);
          }}
          style={{ padding: "1px 4px", fontSize: 11 }}
        >
          {[50, 100, 200, 500, 1000].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
