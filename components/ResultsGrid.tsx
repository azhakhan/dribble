"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DataEditor,
  GridCellKind,
  type GridCell,
  type GridColumn,
  type Item,
  type Theme,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { QueryResult } from "@/lib/drivers/types";

const GRID_THEME: Partial<Theme> = {
  accentColor: "#e8a14c",
  accentLight: "rgba(232,161,76,0.14)",
  textDark: "#d7dbe4",
  textMedium: "#9aa3b5",
  textLight: "#5d6678",
  textHeader: "#9aa3b5",
  textHeaderSelected: "#14161a",
  bgCell: "#1e1e1e",
  bgCellMedium: "#202020",
  bgHeader: "#242424",
  bgHeaderHasFocus: "#2c2c2c",
  bgHeaderHovered: "#2c2c2c",
  borderColor: "#333333",
  horizontalBorderColor: "#2a2a2a",
  drilldownBorder: "#333333",
  linkColor: "#58b8aa",
  bgSearchResult: "#3a2f1a",
  cellHorizontalPadding: 8,
  cellVerticalPadding: 7,
  headerFontStyle: "600 14px",
  baseFontStyle: "12px",
  markerFontStyle: "13px",
  fontFamily: "Roboto Mono, Consolas, monospace",
};

const NUMERIC_TYPES = new Set([
  "int2",
  "int4",
  "int8",
  "float4",
  "float8",
  "numeric",
  "integer",
  "bigint",
  "smallint",
  "real",
  "double precision",
]);

interface Props {
  result: QueryResult;
  sortColumn?: string;
  sortDir?: "asc" | "desc";
  onHeaderClick?: (columnName: string) => void;
}

export default function ResultsGrid({
  result,
  sortColumn,
  sortDir,
  onHeaderClick,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const columns: GridColumn[] = useMemo(
    () =>
      result.columns.map((c, i) => {
        const arrow =
          c.name === sortColumn ? (sortDir === "desc" ? " ↓" : " ↑") : "";
        const id = `${i}:${c.name}`;
        return {
          id,
          title: c.name + arrow,
          width:
            columnWidths[id] ??
            Math.min(Math.max(c.name.length * 10 + 48, 110), 360),
        };
      }),
    [columnWidths, result.columns, sortColumn, sortDir],
  );

  const resizeColumn = useCallback((column: GridColumn, newSize: number) => {
    const id = String(column.id);
    setColumnWidths((prev) => ({ ...prev, [id]: newSize }));
  }, []);

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const value = result.rows[row]?.[col];
      const dataType = result.columns[col]?.dataType ?? "";
      const isNum = NUMERIC_TYPES.has(dataType);
      const display =
        value === null || value === undefined ? "" : String(value);
      return {
        kind: GridCellKind.Text,
        data: display,
        displayData: display === "" && value === null ? "∅" : display,
        allowOverlay: true,
        readonly: true,
        contentAlign: isNum ? "right" : "left",
        themeOverride: value === null ? { textDark: "#5d6678" } : undefined,
      };
    },
    [result],
  );

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: 0, minWidth: 0, position: "relative" }}
    >
      {size.width > 0 && size.height > 0 && (
        <DataEditor
          columns={columns}
          rows={result.rows.length}
          getCellContent={getCellContent}
          width={size.width}
          height={size.height}
          theme={GRID_THEME}
          rowMarkers="number"
          rowHeight={38}
          headerHeight={38}
          minColumnWidth={70}
          maxColumnWidth={900}
          resizeIndicator="full"
          smoothScrollX
          smoothScrollY
          getCellsForSelection
          onColumnResize={resizeColumn}
          onHeaderClicked={
            onHeaderClick
              ? (col) => onHeaderClick(result.columns[col].name)
              : undefined
          }
        />
      )}
    </div>
  );
}
