"use client";

import ResultsGrid from "./ResultsGrid";
import type { QueryResult } from "@/lib/drivers/types";

interface Props {
  result: QueryResult | null;
  error: string | null;
  running: boolean;
  emptyHint: string;
}

export default function ResultsPanel({ result, error, running, emptyHint }: Props) {
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
            <span>{result.rowCount} rows{result.truncated ? " (truncated)" : ""}</span>
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
        ) : result ? (
          <ResultsGrid result={result} />
        ) : (
          <div style={{ display: "grid", placeItems: "center", width: "100%", color: "var(--text-faint)" }}>{emptyHint}</div>
        )}
      </div>
    </div>
  );
}
