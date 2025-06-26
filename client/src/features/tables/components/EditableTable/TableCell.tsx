import type { GridCell } from "@glideapps/glide-data-grid";

interface TableCellProps {
  cell: GridCell;
  column: string;
  row: number;
}

// This component is a placeholder for future cell customization
// Currently, the DataEditor handles cell rendering internally
export const TableCell = ({ cell, column, row }: TableCellProps) => {
  // For now, this is just a utility component that could be extended
  // in the future for custom cell rendering if needed

  // Explicitly mark parameters as used for linter
  void cell;
  void column;
  void row;

  return null;
};

// Utility function for cell content formatting
export const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

// Utility function for cell type detection
export const getCellType = (value: unknown): string => {
  if (typeof value === "number") return "number";
  if (value instanceof Date) return "date";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "json";
  if (typeof value === "string") {
    try {
      new URL(value);
      return "url";
    } catch {
      return "text";
    }
  }
  return "unknown";
};
