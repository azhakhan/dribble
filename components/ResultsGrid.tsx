"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DataEditor,
  GridCellKind,
  type GridCell,
  type GridColumn,
  type Item,
  type ProvideEditorCallbackResult,
  type Theme,
} from "@glideapps/glide-data-grid";
import "@glideapps/glide-data-grid/dist/index.css";
import type { QueryResult } from "@/lib/drivers/types";
import { columnCategory, columnDisplayOrder } from "@/lib/columns";
import { NULL_SENTINEL, makeDateEditor, makeSelectEditor } from "./cellEditors";
import {
  COPIED_ICON,
  COPY_ICON,
  FK_ONLY_ICON,
  HEADER_ICON_SIZE,
  SORT_ASC_ICON,
  SORT_DESC_ICON,
  SORT_NEUTRAL_ICON,
  columnIconName,
  headerIcons,
} from "./headerIcons";

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
  headerIconSize: HEADER_ICON_SIZE,
  baseFontStyle: "12px",
  markerFontStyle: "13px",
  fontFamily: "Roboto Mono, Consolas, monospace",
};

/** Staged-edit wiring for table tabs. Absent → the grid stays read-only
 *  (notebook/chat results). All indexes are original result column indexes. */
export interface GridEditing {
  /** Keep staged values visible while temporarily preventing new edits. */
  disabled?: boolean;
  /** The staged value for a cell, if any. `value: null` = set to SQL NULL. */
  getStaged: (row: number, origColIdx: number) => { value: string | null; failed?: string } | undefined;
  onEdit: (row: number, origColIdx: number, value: string | null) => void;
  /** Unstage one cell. */
  revert: (row: number, origColIdx: number) => void;
  /** Unstage everything. */
  revertAll: () => void;
}

interface Props {
  result: QueryResult;
  sortColumn?: string;
  sortDir?: "asc" | "desc";
  /** Requests a sort by this column, via the header's sort icon (not the header at large). */
  onHeaderClick?: (columnName: string) => void;
  /** Controlled column widths keyed by `${index}:${name}`. When provided, the
   *  parent owns the state (and persists it); otherwise it's local-only. */
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  /** Column names in the desired display order. Names not present in the
   *  result are ignored; result columns not listed are appended in native order. */
  columnOrder?: string[];
  onColumnOrderChange?: (order: string[]) => void;
  editing?: GridEditing;
}

export default function ResultsGrid({
  result,
  sortColumn,
  sortDir,
  onHeaderClick,
  columnWidths: controlledWidths,
  onColumnWidthsChange,
  columnOrder,
  onColumnOrderChange,
  editing,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [localWidths, setLocalWidths] = useState<Record<string, number>>({});
  const columnWidths = controlledWidths ?? localWidths;

  // Briefly swaps a copied column's indicator icon for a checkmark as feedback.
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
  }, []);

  // Which column (display index) the pointer is over, so the copy icon can
  // appear only on hover instead of cluttering every header.
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  // Right-click revert menu for staged cells (viewport coordinates, as .ctx-menu
  // is position:fixed; glide's bounds are grid-relative).
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; row: number; origIdx: number } | null>(null);

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

  // Map from display column index → original index into result.columns/rows.
  const order: number[] = useMemo(
    () => columnDisplayOrder(result.columns.map((c) => c.name), columnOrder),
    [result.columns, columnOrder],
  );

  // Editability is a pure function of the column metadata: primary-key columns
  // anchor the row's identity, and bytea/arrays round-trip lossily as text.
  const isEditableCol = useCallback(
    (origIdx: number) => {
      const c = result.columns[origIdx];
      if (!c || c.isPrimaryKey) return false;
      const cat = columnCategory(c.dataType);
      return cat !== "binary" && cat !== "array";
    },
    [result.columns],
  );

  // Editor components are created once per column so their component types stay
  // stable across renders — recreating them per provideEditor call would remount
  // the open overlay (losing focus and local state) on every grid re-render.
  const editingEnabled = !!editing;
  const editorByCol = useMemo(() => {
    if (!editingEnabled) return undefined;
    const map = new Map<number, NonNullable<ProvideEditorCallbackResult<GridCell>>>();
    result.columns.forEach((c, origIdx) => {
      if (!isEditableCol(origIdx)) return;
      const nullOpt = c.nullable ? [{ label: "∅ null", value: NULL_SENTINEL }] : [];
      if (c.enumValues?.length) {
        map.set(
          origIdx,
          makeSelectEditor([...c.enumValues.map((v) => ({ label: v, value: v })), ...nullOpt]),
        );
        return;
      }
      const cat = columnCategory(c.dataType);
      if (cat === "boolean") {
        map.set(
          origIdx,
          makeSelectEditor([
            { label: "true", value: "true" },
            { label: "false", value: "false" },
            ...nullOpt,
          ]),
        );
      } else if (cat === "date") {
        map.set(origIdx, makeDateEditor(false));
      } else if (cat === "timestamp") {
        map.set(origIdx, makeDateEditor(true, /with time zone|timestamptz/i.test(c.dataType)));
      }
    });
    return map;
  }, [editingEnabled, result.columns, isEditableCol]);

  const columns: GridColumn[] = useMemo(
    () =>
      order.map((origIdx, displayIdx) => {
        const c = result.columns[origIdx];
        // Keep the id stable per source column so widths follow it on reorder.
        const id = `${origIdx}:${c.name}`;
        const isSorted = c.name === sortColumn;
        return {
          id,
          title: c.name,
          // Type glyph, with a key glyph beside it. Both-key columns are rare
          // enough to hand the paired slot to the primary key and let the
          // reference marker trail the name, rather than widen every header.
          icon: columnIconName(
            columnCategory(c.dataType),
            c.isPrimaryKey ? "pk" : c.isForeignKey ? "fk" : undefined,
          ),
          // Right after the title: a copy icon while hovering this column
          // (briefly a checkmark right after copying), otherwise the FK
          // marker for both-key columns, otherwise nothing.
          indicatorIcon:
            copiedId === id
              ? COPIED_ICON
              : hoveredCol === displayIdx
                ? COPY_ICON
                : c.isPrimaryKey && c.isForeignKey
                  ? FK_ONLY_ICON
                  : undefined,
          // The sort button always lives in this fixed, right-aligned slot —
          // whether it's showing the neutral (click-to-sort) glyph or the
          // active column's direction — so it never jumps around on sort.
          hasMenu: !!onHeaderClick,
          menuIcon: isSorted
            ? sortDir === "desc"
              ? SORT_DESC_ICON
              : SORT_ASC_ICON
            : SORT_NEUTRAL_ICON,
          width:
            columnWidths[id] ??
            Math.min(Math.max(c.name.length * 10 + 80, 140), 380),
        };
      }),
    [order, columnWidths, result.columns, sortColumn, sortDir, onHeaderClick, copiedId, hoveredCol],
  );

  const resizeColumn = useCallback(
    (column: GridColumn, newSize: number) => {
      const id = String(column.id);
      const next = { ...columnWidths, [id]: newSize };
      if (onColumnWidthsChange) onColumnWidthsChange(next);
      else setLocalWidths(next);
    },
    [columnWidths, onColumnWidthsChange],
  );

  const getCellContent = useCallback(
    ([col, row]: Item): GridCell => {
      const origIdx = order[col];
      const value = result.rows[row]?.[origIdx];
      const isNum = columnCategory(result.columns[origIdx]?.dataType ?? "") === "number";
      const staged = editing?.getStaged(row, origIdx);
      const nullish = staged ? staged.value === null : value === null || value === undefined;
      const display = staged
        ? (staged.value ?? "")
        : nullish
          ? ""
          : String(value);
      return {
        kind: GridCellKind.Text,
        data: display,
        displayData: display === "" && nullish ? "∅" : display,
        allowOverlay: true,
        readonly: !(editing && !editing.disabled && isEditableCol(origIdx)),
        contentAlign: isNum ? "right" : "left",
        // Staged cells are tinted: amber while pending, red after a failed save.
        themeOverride: staged
          ? { bgCell: staged.failed ? "rgba(224,90,90,0.22)" : "rgba(232,161,76,0.16)" }
          : nullish
            ? { textDark: "#5d6678" }
            : undefined,
      };
    },
    [result, order, editing, isEditableCol],
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
          headerIcons={headerIcons}
          rowMarkers="number"
          rowHeight={38}
          headerHeight={38}
          minColumnWidth={70}
          maxColumnWidth={900}
          resizeIndicator="full"
          smoothScrollX
          smoothScrollY
          getCellsForSelection
          onCellEdited={
            editing && !editing.disabled
              ? ([col, row], newValue) => {
                  if (newValue.kind !== GridCellKind.Text) return;
                  const data = newValue.data;
                  editing.onEdit(row, order[col], data === NULL_SENTINEL ? null : data);
                }
              : undefined
          }
          provideEditor={
            editing && !editing.disabled
              ? (cell) => {
                  const loc = cell.location;
                  if (!loc) return undefined;
                  // The overlay reports its location in glide's internal
                  // ("mangled") coordinates, where the row-marker gutter counts
                  // as column 0 — shift back to data columns before mapping.
                  const origIdx = order[loc[0] - 1];
                  return editorByCol?.get(origIdx);
                }
              : undefined
          }
          onColumnResize={resizeColumn}
          onCellContextMenu={
            editing
              ? ([col, row], event) => {
                  const origIdx = order[col];
                  // Only staged cells get the revert menu; others keep the
                  // browser default.
                  if (!editing.getStaged(row, origIdx)) return;
                  event.preventDefault();
                  const rect = containerRef.current?.getBoundingClientRect();
                  setCtxMenu({
                    x: (rect?.left ?? 0) + event.bounds.x,
                    y: (rect?.top ?? 0) + event.bounds.y + event.bounds.height,
                    row,
                    origIdx,
                  });
                }
              : undefined
          }
          onColumnMoved={
            onColumnOrderChange
              ? (startIndex, endIndex) => {
                  const names = order.map((i) => result.columns[i].name);
                  const [moved] = names.splice(startIndex, 1);
                  names.splice(endIndex, 0, moved);
                  onColumnOrderChange(names);
                }
              : undefined
          }
          onHeaderMenuClick={
            onHeaderClick
              ? (col) => onHeaderClick(result.columns[order[col]].name)
              : undefined
          }
          onHeaderIndicatorClick={(col) => {
            const origIdx = order[col];
            const name = result.columns[origIdx]?.name;
            if (!name || !navigator.clipboard) return;
            const id = `${origIdx}:${name}`;
            navigator.clipboard
              .writeText(name)
              .then(() => {
                setCopiedId(id);
                if (copiedTimeout.current) clearTimeout(copiedTimeout.current);
                copiedTimeout.current = setTimeout(() => setCopiedId(null), 900);
              })
              .catch(() => {});
          }}
          onItemHovered={(args) => {
            setHoveredCol(args.kind === "header" ? args.location[0] : null);
          }}
        />
      )}
      {ctxMenu && editing && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 100 }}
          onClick={() => setCtxMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setCtxMenu(null);
          }}
        >
          <div
            className="ctx-menu"
            style={{
              left: Math.max(0, Math.min(ctxMenu.x, window.innerWidth - 200)),
              top: Math.max(0, Math.min(ctxMenu.y, window.innerHeight - 90)),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="ctx-item"
              onClick={() => {
                editing.revert(ctxMenu.row, ctxMenu.origIdx);
                setCtxMenu(null);
              }}
            >
              Revert change
            </button>
            <button
              className="ctx-item"
              onClick={() => {
                editing.revertAll();
                setCtxMenu(null);
              }}
            >
              Revert all changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
