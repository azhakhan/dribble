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

const data = [
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

// Grid columns may also provide icon, overlayIcon, menu, style, and theme overrides
const columns: GridColumn[] = [
  { title: "First Name", width: 100 },
  { title: "Last Name", width: 100 },
];

// If fetching data is slow you can use the DataEditor ref to send updates for cells
// once data is loaded.
function getData([col, row]: Item): GridCell {
  const person = data[row];

  if (col === 0) {
    return {
      kind: GridCellKind.Text,
      data: person.firstName,
      allowOverlay: false,
      displayData: person.firstName,
    };
  } else if (col === 1) {
    return {
      kind: GridCellKind.Text,
      data: person.lastName,
      allowOverlay: false,
      displayData: person.lastName,
    };
  } else {
    throw new Error();
  }
}

export const EditableTable = () => {
  const { theme } = useTheme();

  const getGlideTheme = (): GlideTheme => {
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    return {
      accentColor: isDark ? "var(--accent)" : "var(--accent)",
      accentFg: isDark
        ? "var(--accent-foreground)"
        : "var(--accent-foreground)",
      accentLight: isDark ? "var(--muted)" : "var(--muted)",
      textDark: isDark ? "var(--foreground)" : "var(--foreground)",
      textMedium: isDark
        ? "var(--muted-foreground)"
        : "var(--muted-foreground)",
      textLight: isDark ? "var(--muted-foreground)" : "var(--muted-foreground)",
      textBubble: isDark ? "var(--card)" : "var(--card)",
      bgIconHeader: isDark ? "var(--card)" : "var(--card)",
      fgIconHeader: isDark ? "var(--foreground)" : "var(--foreground)",
      textHeader: isDark ? "var(--foreground)" : "var(--foreground)",
      textGroupHeader: isDark
        ? "var(--muted-foreground)"
        : "var(--muted-foreground)",
      textHeaderSelected: isDark ? "var(--foreground)" : "var(--foreground)",
      bgCell: isDark ? "var(--card)" : "var(--background)",
      bgCellMedium: isDark ? "var(--muted)" : "var(--muted)",
      bgHeader: isDark ? "var(--card)" : "var(--background)",
      bgHeaderHasFocus: isDark ? "var(--card)" : "var(--background)",
      bgHeaderHovered: isDark ? "var(--muted)" : "var(--muted)",
      bgBubble: isDark ? "var(--card)" : "var(--card)",
      bgBubbleSelected: isDark ? "var(--muted)" : "var(--muted)",
      bgSearchResult: isDark ? "var(--muted)" : "var(--muted)",
      borderColor: isDark ? "var(--border)" : "var(--border)",
      drilldownBorder: isDark ? "var(--border)" : "var(--border)",
      linkColor: isDark ? "var(--accent)" : "var(--accent)",
      cellHorizontalPadding: 10,
      cellVerticalPadding: 10,
      headerFontStyle: "bold",
      headerIconSize: 16,
      baseFontStyle: "normal",
      markerFontStyle: "normal",
      fontFamily: "var(--font-sans)",
      editorFontSize: "14px",
      lineHeight: 1.5,
    };
  };

  return (
    <DataEditor
      columns={columns}
      getCellContent={getData}
      rows={data.length}
      // theme={getGlideTheme()}
    />
  );
};
