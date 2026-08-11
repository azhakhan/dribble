"use client";

import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { ICON_SIZE } from "./IconButton";

const PAGE_SIZES = [50, 100, 200, 500, 1000];

interface Props {
  page: number;
  totalPages: number | null;
  limit: number;
  totalCount?: number | null;
  rowsOnPage: number;
  onPage: (page: number) => void;
  onLimit: (limit: number) => void;
}

export default function PaginationBar({ page, totalPages, limit, totalCount, rowsOnPage, onPage, onLimit }: Props) {
  const hasNext = totalPages != null ? page + 1 < totalPages : rowsOnPage >= limit;

  return (
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
      <button className="btn-ghost" style={{ display: "flex", padding: "1px 8px" }} disabled={page === 0} onClick={() => onPage(0)}>
        <ChevronsLeft size={ICON_SIZE} />
      </button>
      <button className="btn-ghost" style={{ display: "flex", padding: "1px 8px" }} disabled={page === 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft size={ICON_SIZE} />
      </button>
      <span>
        page {page + 1}
        {totalPages != null ? ` / ${totalPages}` : ""}
      </span>
      <button className="btn-ghost" style={{ display: "flex", padding: "1px 8px" }} disabled={!hasNext} onClick={() => onPage(page + 1)}>
        <ChevronRight size={ICON_SIZE} />
      </button>
      {totalPages != null && (
        <button className="btn-ghost" style={{ display: "flex", padding: "1px 8px" }} disabled={page + 1 >= totalPages} onClick={() => onPage(totalPages - 1)}>
          <ChevronsRight size={ICON_SIZE} />
        </button>
      )}
      <span style={{ marginLeft: "auto" }}>
        {totalCount != null ? `${totalCount.toLocaleString()} rows` : ""}
      </span>
      <select
        value={limit}
        onChange={(e) => onLimit(Number(e.target.value))}
        style={{ padding: "1px 4px", fontSize: 11 }}
      >
        {PAGE_SIZES.map((n) => (
          <option key={n} value={n}>
            {n} / page
          </option>
        ))}
      </select>
    </div>
  );
}
