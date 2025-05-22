import "@glideapps/glide-data-grid/dist/index.css";

import {
  DataEditor,
  type GridCell,
  GridCellKind,
  type GridColumn,
  type Item,
  type Theme as GlideTheme,
} from "@glideapps/glide-data-grid";
import { useTheme } from "@/components/theme-provider";
import { useCallback, useMemo, useState, useEffect, useRef } from "react";

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
  lineHeight: 1.4, //unitless scaler depends on your font
};

// Default columns
const defaultColumns: GridColumn[] = [
  { title: "First Name", width: 200 },
  { title: "Last Name", width: 200 },
];

interface EditableTableProps {
  data?: Record<string, unknown>[];
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
const saveColumnSizes = (
  storageKey: string | null,
  sizes: Record<string, number>
) => {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(sizes));
  } catch (e) {
    console.error("Failed to save column sizes:", e);
  }
};

export const EditableTable = ({
  data: queryData,
  isLoading,
  tableId = "default",
  source,
  schema,
}: EditableTableProps) => {
  const { theme } = useTheme();
  const initializedRef = useRef(false);
  const storageKey = useMemo(
    () => getStorageKey(tableId, source, schema),
    [tableId, source, schema]
  );

  // Use query data if available, otherwise use default data
  const data = useMemo(() => queryData || [], [queryData]);

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
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    return {
      ...dataEditorBaseTheme,
      // Accent colors
      accentColor: isDark
        ? "oklch(0.274 0.006 286.033)"
        : "oklch(0.967 0.001 286.375)",
      accentLight: isDark
        ? "oklch(0.274 0.006 286.033)"
        : "oklch(0.967 0.001 286.375)",

      // Text colors
      textDark: isDark ? "oklch(0.985 0 0)" : "oklch(0.141 0.005 285.823)",

      // Header colors
      textHeader: isDark ? "oklch(0.985 0 0)" : "oklch(0.141 0.005 285.823)",
      textHeaderSelected: isDark
        ? "oklch(0.985 0 0)"
        : "oklch(0.141 0.005 285.823)",

      // Cell and background colors
      bgCell: isDark ? "#171717" : "#fafafa",
      bgHeader: isDark ? "oklch(0.21 0.006 285.885)" : "oklch(1 0 0)",
      bgHeaderHasFocus: isDark ? "oklch(0.21 0.006 285.885)" : "oklch(1 0 0)",
      bgHeaderHovered: isDark
        ? "oklch(0.274 0.006 286.033)"
        : "oklch(0.967 0.001 286.375)",

      // Border and link colors
      borderColor: isDark ? "oklch(1 0 0 / 10%)" : "oklch(0.92 0.004 286.32)",
    };
  };

  // Dynamically determine column headers from data
  const columns = useMemo(() => {
    if (data.length === 0) return defaultColumns;

    return Object.keys(data[0]).map((key) => ({
      title: key,
      width: columnSizes[key] || 200, // Use stored width or default
      id: key,
    }));
  }, [data, columnSizes]);

  const dataIndexes = useMemo(() => {
    return data.length > 0 ? Object.keys(data[0]) : [];
  }, [data]);

  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [col, row] = cell;

      if (row >= data.length) {
        return {
          kind: GridCellKind.Text,
          displayData: "",
          data: "",
        } as GridCell;
      }

      const dataRow = data[row] as Record<string, unknown>;
      const columnName = dataIndexes[col];

      if (columnName === undefined) {
        return {
          kind: GridCellKind.Text,
          displayData: "",
          data: "",
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
        copyData: cellValue,
      } as GridCell;
    },
    [dataIndexes, data]
  );

  const handleColumnResize = (
    column: GridColumn,
    newSize: number,
    colIndex: number
  ) => {
    console.log("Column resized:", column.title, newSize, colIndex);

    // Update the column size in state
    const newColumnSizes = {
      ...columnSizes,
      [column.title]: newSize,
    };

    setColumnSizes(newColumnSizes);

    // Save to localStorage
    if (storageKey) {
      saveColumnSizes(storageKey, newColumnSizes);
    }
  };

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        Loading data...
      </div>
    );
  }

  return (
    <DataEditor
      columns={columns}
      getCellContent={getCellContent}
      rows={data.length}
      theme={getGlideTheme()}
      width="100%"
      height="100%"
      smoothScrollX
      smoothScrollY
      rowHeight={30}
      onColumnResize={handleColumnResize}
    />
  );
};
