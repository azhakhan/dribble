import { useCallback, useMemo } from "react";
import { useTheme } from "@/components/theme-provider";
import { GridCellKind } from "@glideapps/glide-data-grid";
import type { GridCell, Theme as GlideTheme, Item } from "@glideapps/glide-data-grid";
import type { TableRow } from "@/shared/types/api";

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

interface UseTableEditingParams {
  data: Record<string, unknown>[];
  dataIndexes: string[];
}

export const useTableEditing = ({ data, dataIndexes }: UseTableEditingParams) => {
  const { resolvedTheme } = useTheme();

  // Memoized custom header icons - prevent recreation on every render
  const customHeaderIcons = useMemo(
    () => ({
      text: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-case-upper-icon lucide-case-upper"><path d="m3 15 4-8 4 8"/><path d="M4 13h6"/><path d="M15 11h4.5a2 2 0 0 1 0 4H15V7h4a2 2 0 0 1 0 4"/></svg>`,
      number: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-hash"><line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/></svg>`,
      date: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
      url: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-link"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
      image: ({ fgColor }: { fgColor: string }) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${fgColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-image"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`
    }),
    []
  );

  // Memoized theme generation
  const getGlideTheme = useMemo((): GlideTheme => {
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
  }, [resolvedTheme]);

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

  return {
    customHeaderIcons,
    getGlideTheme,
    getCellContent
  };
};
