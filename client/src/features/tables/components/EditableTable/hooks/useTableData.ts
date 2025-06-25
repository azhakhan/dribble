import { useMemo } from "react";
import type { GridColumn } from "@glideapps/glide-data-grid";
import type { ColumnDefinition, TableData } from "@/shared/types/api";
import { createNoDataMessage } from "@/shared/utils/errorUtils";

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

// Default columns
const defaultColumns: GridColumn[] = [{ title: "Status", width: 300 }];

interface UseTableDataParams {
  data?: TableData;
  columns?: ColumnDefinition[];
  columnSizes: Record<string, number>;
}

export const useTableData = ({
  data: queryData,
  columns: providedColumns,
  columnSizes
}: UseTableDataParams) => {
  // Memoized data processing
  const data = useMemo(() => {
    if (!queryData || !Array.isArray(queryData) || queryData.length === 0) {
      return createNoDataMessage();
    }
    return queryData;
  }, [queryData]);

  // Memoized columns definition
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

  // Memoized column indexes
  const dataIndexes = useMemo(() => {
    if (!data || data.length === 0 || !data[0]) {
      return ["status"]; // Default column if no data
    }
    return Object.keys(data[0]);
  }, [data]);

  return {
    processedData: data,
    columns,
    dataIndexes
  };
};
