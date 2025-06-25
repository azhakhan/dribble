import "@glideapps/glide-data-grid/dist/index.css";

import {
  DataEditor,
  type GridCell,
  GridCellKind,
  type GridColumn,
  type Item,
  type Theme as GlideTheme
} from "@glideapps/glide-data-grid";
import { useTheme } from "@/components/theme-provider";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import type { TableRow, ColumnDefinition, TableData } from "@/shared/types/api";

const dataEditorBaseTheme: GlideTheme = {
  accentColor: "#4F5DFF",
  accentFg: "#FFFFFF",
  accentLight: "rgba(62, 116, 253, 0.1)",

  textDark: "#313139",
  textMedium: "#737383",
  textLight: "#B2B2C0",
  textBubble: "#313139",

  bgIconHeader: "#737383",
  fgIconHeader: "#FFFFFF",
  textHeader: "#313139",
  textGroupHeader: "#313139BB",
  textHeaderSelected: "#FFFFFF",

  bgCell: "#FFFFFF",
  bgCellMedium: "#FAFAFB",
  bgHeader: "#F7F7F8",
  bgHeaderHasFocus: "#E9E9EB",
  bgHeaderHovered: "#EFEFF1",

  bgBubble: "#EDEDF3",
  bgBubbleSelected: "#FFFFFF",

  bgSearchResult: "#fff9e3",

  borderColor: "rgba(115, 116, 131, 0.16)",
  drilldownBorder: "rgba(0, 0, 0, 0)",

  linkColor: "#353fb5",

  cellHorizontalPadding: 8,
  cellVerticalPadding: 3,

  headerIconSize: 18,

  headerFontStyle: "600 13px",
  baseFontStyle: "13px",
  markerFontStyle: "9px",
  fontFamily:
    "Inter, Roboto, -apple-system, BlinkMacSystemFont, avenir next, avenir, segoe ui, helvetica neue, helvetica, Ubuntu, noto, arial, sans-serif",
  editorFontSize: "13px",
  lineHeight: 1.4 //unitless scaler depends on your font
};

// Default columns
const defaultColumns: GridColumn[] = [{ title: "Status", width: 300 }];

interface EditableTableProps {
  data?: TableData;
  columns?: ColumnDefinition[];
  isLoading?: boolean;
  tableId?: string; // Unique identifier for this table
  source?: string; // Optional source identifier
  schema?: string; // Optional schema identifier
}

// Helper to generate storage key
const getStorageKey = (tableId?: string, source?: string, schema?: string) => {
  const parts = [source, schema, tableId].filter(Boolean);
  return parts.length > 0 ? `table_columns_${parts.join("_")}` : null;
};

// Helper to load column sizes from localStorage
const loadColumnSizes = (storageKey: string | null) => {
  if (!storageKey) return {};
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? JSON.parse(saved) : {};
  } catch (e) {
    console.error("Failed to load column sizes:", e);
    return {};
  }
};

// Helper to save column sizes to localStorage
const saveColumnSizes = (storageKey: string | null, sizes: Record<string, number>) => {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(sizes));
  } catch (e) {
    console.error("Failed to save column sizes:", e);
  }
};

// Helper to determine column type
const getColumnType = (value: unknown): ColumnDefinition["type"] => {
  if (typeof value === "number") return "number";
  if (value instanceof Date) return "date";
  if (typeof value === "string") {
    // Check if it's a URL
    try {
      new URL(value);
      return "url";
    } catch {
      return "text";
    }
  }
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "json";
  return "unknown";
};

export const EditableTable = ({
  data: queryData,
  columns: providedColumns,
  isLoading,
  tableId = "default",
  source,
  schema
}: EditableTableProps) => {
  const { resolvedTheme } = useTheme();
  const initializedRef = useRef(false);
  const storageKey = useMemo(
    () => getStorageKey(tableId, source, schema),
    [tableId, source, schema]
  );

  // Custom header icons
  const customHeaderIcons = useMemo(
    () => ({
      text: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-case-upper-icon lucide-case-upper"><path d="m3 15 4-8 4 8"/><path d="M4 13h6"/><path d="M15 11h4.5a2 2 0 0 1 0 4H15V7h4a2 2 0 0 1 0 4"/></svg>`,
      number: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hash"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`,
      // number: ({ fgColor }: { fgColor: string }) =>,
      date: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
      url: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      image: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`
    }),
    []
  );

  // Use query data if available, otherwise use default data
  const data = useMemo(() => {
    // Ensure data is an array and not null/undefined
    if (!queryData || !Array.isArray(queryData) || queryData.length === 0) {
      return [{ status: "No data available" }];
    }
    return queryData;
  }, [queryData]);

  // State for managing column sizes
  const [columnSizes, setColumnSizes] = useState<Record<string, number>>({});

  // Load saved column sizes from localStorage on mount
  useEffect(() => {
    if (!initializedRef.current && storageKey) {
      const savedSizes = loadColumnSizes(storageKey);
      setColumnSizes(savedSizes);
      initializedRef.current = true;
    }
  }, [storageKey]);

  // Initialize column sizes when data changes
  useEffect(() => {
    if (data.length > 0 && initializedRef.current) {
      const keys = Object.keys(data[0]);
      const newSizes = { ...columnSizes };
      let changed = false;

      // Add any missing columns with default width
      keys.forEach((key) => {
        if (newSizes[key] === undefined) {
          newSizes[key] = 200;
          changed = true;
        }
      });

      if (changed) {
        setColumnSizes(newSizes);
        if (storageKey) saveColumnSizes(storageKey, newSizes);
      }
    }
  }, [data, columnSizes, storageKey]);

  const getGlideTheme = (): GlideTheme => {
    const isDark = resolvedTheme === "dark";

    return {
      ...dataEditorBaseTheme,
      // Accent colors
      accentColor: isDark ? "oklch(0.274 0.006 286.033)" : "oklch(0.967 0.001 286.375)",
      accentLight: isDark ? "oklch(0.274 0.006 286.033)" : "oklch(0.967 0.001 286.375)",

      // Text colors
      textDark: isDark ? "oklch(0.985 0 0)" : "oklch(0.141 0.005 285.823)",

      // Header colors
      textHeader: isDark ? "oklch(0.985 0 0)" : "oklch(0.141 0.005 285.823)",
      textHeaderSelected: isDark ? "oklch(0.985 0 0)" : "oklch(0.141 0.005 285.823)",

      // Icon colors
      bgIconHeader: isDark ? "#737383" : "#737383",
      fgIconHeader: isDark ? "#FFFFFF" : "#313139",

      // Cell and background colors
      bgCell: isDark ? "#171717" : "#fafafa",
      bgHeader: isDark ? "oklch(0.21 0.006 285.885)" : "oklch(1 0 0)",
      bgHeaderHasFocus: isDark ? "oklch(0.21 0.006 285.885)" : "oklch(1 0 0)",
      bgHeaderHovered: isDark ? "oklch(0.274 0.006 286.033)" : "oklch(0.967 0.001 286.375)",

      // Border and link colors
      borderColor: isDark ? "oklch(1 0 0 / 10%)" : "oklch(0.92 0.004 286.32)",
      drilldownBorder: isDark ? "#2E2E2E" : "#E4E4E7",
      headerBottomBorderColor: isDark ? "#2E2E2E" : "#E4E4E7",
      resizeIndicatorColor: isDark ? "#2E2E2E" : "#E4E4E7",
      horizontalBorderColor: isDark ? "#2E2E2E" : "#E4E4E7"
    };
  };

  // Update the columns definition
  const columns = useMemo(() => {
    // Use provided columns if available
    if (providedColumns && providedColumns.length > 0) {
      return providedColumns.map((col) => ({
        title: col.name,
        width: columnSizes[col.name] || col.width || 200,
        id: col.name,
        icon: col.type
      }));
    }

    // Safe check to ensure data[0] exists
    if (!data || data.length === 0 || !data[0]) {
      return defaultColumns;
    }

    return Object.keys(data[0]).map((key) => {
      const value = data[0][key];
      const columnType = getColumnType(value);

      return {
        title: key,
        width: columnSizes[key] || 200,
        id: key,
        icon: columnType // This will map to our custom icons
      };
    });
  }, [data, columnSizes, providedColumns]);

  // Get column indexes safely
  const dataIndexes = useMemo(() => {
    if (!data || data.length === 0 || !data[0]) {
      return ["status"]; // Default column if no data
    }
    return Object.keys(data[0]);
  }, [data]);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;

      if (!data || row >= data.length) {
        return {
          kind: GridCellKind.Text,
          displayData: "",
          data: ""
        } as GridCell;
      }

      const dataRow = data[row] as TableRow;
      const columnName = dataIndexes[col];

      if (columnName === undefined) {
        return {
          kind: GridCellKind.Text,
          displayData: "",
          data: ""
        } as GridCell;
      }

      let cellValue = dataRow[columnName];

      // Handle different data types for display
      if (cellValue === null) {
        cellValue = "null";
      } else if (typeof cellValue === "object") {
        cellValue = JSON.stringify(cellValue);
      } else {
        cellValue = String(cellValue);
      }

      return {
        kind: GridCellKind.Text,
        displayData: cellValue,
        data: cellValue,
        copyData: cellValue
      } as GridCell;
    },
    [dataIndexes, data]
  );

  const handleColumnResize = (column: GridColumn, newSize: number) => {
    // Update the column size in state
    const newColumnSizes = {
      ...columnSizes,
      [column.title]: newSize
    };

    setColumnSizes(newColumnSizes);

    // Save to localStorage
    if (storageKey) {
      saveColumnSizes(storageKey, newColumnSizes);
    }
  };

  if (isLoading) {
    return <div className="h-full w-full flex items-center justify-center">Loading data...</div>;
  }

  return (
    <DataEditor
      columns={columns}
      headerIcons={customHeaderIcons}
      getCellContent={getCellContent}
      rows={data.length}
      theme={getGlideTheme()}
      width="100%"
      height="100%"
      smoothScrollX
      smoothScrollY
      rowHeight={30}
      onColumnResize={handleColumnResize}
      rowMarkers="number"
    />
  );
};
