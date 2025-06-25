import type { TableRow, TableData, ColumnDefinition } from "../types/api";

/**
 * Safely converts unknown data to TableRow format
 */
export const convertToTableRow = (data: unknown): TableRow => {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    // Convert object to TableRow, ensuring all values are valid types
    const row: TableRow = {};
    for (const [key, value] of Object.entries(data)) {
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        value === null ||
        value instanceof Date
      ) {
        row[key] = value;
      } else if (typeof value === "object") {
        // Convert objects to JSON strings for display
        row[key] = value;
      } else {
        // Convert other types to strings
        row[key] = String(value);
      }
    }
    return row;
  }

  // Fallback for non-object data
  return { value: String(data) };
};

/**
 * Safely converts unknown data array to TableData format
 */
export const convertToTableData = (data: unknown): TableData => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data.map(convertToTableRow);
};

/**
 * Type guard to check if data is already in TableData format
 */
export const isValidTableData = (data: unknown): data is TableData => {
  return (
    Array.isArray(data) &&
    data.every((row) => typeof row === "object" && row !== null && !Array.isArray(row))
  );
};

/**
 * Infer column definitions from table data
 */
export const inferColumnDefinitions = (data: TableData): ColumnDefinition[] => {
  if (data.length === 0) {
    return [];
  }

  const firstRow = data[0];
  const columns: ColumnDefinition[] = [];

  for (const [key, value] of Object.entries(firstRow)) {
    columns.push({
      name: key,
      type: inferColumnType(value),
      nullable: data.some((row) => row[key] === null)
    });
  }

  return columns;
};

/**
 * Infer column type from a value
 */
const inferColumnType = (value: unknown): ColumnDefinition["type"] => {
  if (value === null) return "unknown";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date) return "date";
  if (typeof value === "string") {
    // Check if it's a URL
    try {
      new URL(value);
      return "url";
    } catch {
      // Check if it looks like a UUID
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
        return "uuid";
      }
      return "text";
    }
  }
  if (typeof value === "object") return "json";
  return "unknown";
};
