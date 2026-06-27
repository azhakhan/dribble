"use client";

import { useState } from "react";
import ResultsGrid from "./ResultsGrid";
import PaginationBar from "./PaginationBar";
import type { QueryResult } from "@/lib/drivers/types";

/**
 * When set, paging is controlled by the parent: `result.rows` is already the
 * current page (server-side LIMIT/OFFSET) and nothing is sliced locally.
 */
interface ServerPagination {
  page: number;
  limit: number;
  totalCount: number | null;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
}

interface Props {
  result: QueryResult | null;
  error: string | null;
  running: boolean;
  emptyHint: string;
  serverPagination?: ServerPagination | null;
}

export default function ResultsPanel({ result, error, running, emptyHint, serverPagination }: Props) {
  const [localPage, setLocalPage] = useState(0);
  const [localLimit, setLocalLimit] = useState(100);

  // Reset to the first page whenever a new (local-mode) result arrives.
  const [prevResult, setPrevResult] = useState(result);
  if (result !== prevResult) {
    setPrevResult(result);
    setLocalPage(0);
  }

  const server = serverPagination ?? null;
  const page = server ? server.page : localPage;
  const limit = server ? server.limit : localLimit;
  const setPage = server ? server.onPage : setLocalPage;

  // Server mode: rows are already the current page, and the total comes from a
  // count(*). Local mode: paginate the in-memory rows client-side.
  const totalCount = server ? server.totalCount : result?.rowCount ?? 0;
  const totalPages =
    result && totalCount != null ? Math.max(1, Math.ceil(totalCount / limit)) : null;
  const pagedResult = result
    ? server
      ? result
      : { ...result, rows: result.rows.slice(page * limit, page * limit + limit) }
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: "var(--bg1)" }}>
      <div
        className="mono"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "4px 12px",
          fontSize: 11,
          color: "var(--text-dim)",
          borderBottom: "1px solid var(--border-soft)",
          flexShrink: 0,
        }}
      >
        <span style={{ letterSpacing: "0.08em", color: "var(--text-faint)" }}>RESULTS</span>
        {running && (
          <span className="pulse" style={{ color: "var(--accent)" }}>
            ● running…
          </span>
        )}
        {result && !running && (
          <>
            <span>
              {server && totalCount != null
                ? `${totalCount.toLocaleString()} rows`
                : `${result.rowCount} rows${result.truncated ? " (truncated)" : ""}`}
            </span>
            <span>{result.durationMs} ms</span>
          </>
        )}
        {error && !running && <span style={{ color: "var(--danger)" }}>error</span>}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex" }}>
        {error && !running ? (
          <pre
            className="mono"
            style={{ margin: 0, padding: 16, color: "var(--danger)", fontSize: 12, whiteSpace: "pre-wrap", overflow: "auto", width: "100%" }}
          >
            {error}
          </pre>
        ) : pagedResult ? (
          <ResultsGrid result={pagedResult} />
        ) : (
          <div style={{ display: "grid", placeItems: "center", width: "100%", color: "var(--text-faint)" }}>{emptyHint}</div>
        )}
      </div>
      {pagedResult && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          limit={limit}
          totalCount={totalCount}
          rowsOnPage={pagedResult.rows.length}
          onPage={setPage}
          onLimit={(n) => {
            if (server) server.onLimit(n);
            else { setLocalLimit(n); setLocalPage(0); }
          }}
        />
      )}
    </div>
  );
}
