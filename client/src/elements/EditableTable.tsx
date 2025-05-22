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
import { useCallback, useMemo } from "react";

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

// Default data for when no query results are available
const defaultData: Record<string, unknown>[] = [
  {
    firstName: "John",
    lastName: "Doe",
  },
  {
    firstName: "Maria",
    lastName: "Garcia",
  },
  {
    firstName: "Nancy",
    lastName: "Jones",
  },
  {
    firstName: "James",
    lastName: "Smith",
  },
];

// Default columns
const defaultColumns: GridColumn[] = [
  { title: "First Name", width: 200 },
  { title: "Last Name", width: 200 },
];

interface EditableTableProps {
  data?: Record<string, unknown>[];
  isLoading?: boolean;
}

export const EditableTable = ({
  data: queryData,
  isLoading,
}: EditableTableProps) => {
  const { theme } = useTheme();

  // Use query data if available, otherwise use default data
  const data = useMemo(() => queryData || defaultData, [queryData]);

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
      width: 200,
    }));
  }, [data]);

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
      } as GridCell;
    },
    [dataIndexes, data]
  );

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
    />
  );
};
