// Column definition types
export interface ColumnDefinition {
  name: string;
  type: "text" | "number" | "date" | "boolean" | "url" | "json" | "uuid" | "unknown";
  nullable?: boolean;
  width?: number;
}

// Table row types
export interface TableRow {
  [key: string]: string | number | boolean | null | Date | object;
}

// Strict API response wrapper
export interface StrictApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    rowCount: number;
    executionTime: number;
    columns: ColumnDefinition[];
  };
}

// Query execution result types
export interface QueryExecutionResult {
  rows: TableRow[];
  columns: ColumnDefinition[];
  rowCount: number;
  executionTime: number;
  error?: string;
}

// Query execution metadata
export interface QueryExecutionMetadata {
  rowCount: number;
  executionTime: number;
  columns: ColumnDefinition[];
  hasMore?: boolean;
  totalRows?: number;
}

// API response for query results
export interface QueryResultsResponse extends StrictApiResponse<TableRow[]> {
  metadata: QueryExecutionMetadata;
}

// Pagination response type
export interface PaginatedApiResponse<T> extends StrictApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Table filter and pagination state
export interface TableFilterParams {
  limit?: number;
  offset?: number;
  where?: string;
  orderBy?: string;
}

// Enhanced column metadata for UI
export interface UIColumnDefinition extends ColumnDefinition {
  sortable?: boolean;
  filterable?: boolean;
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
}

// Schema-related types for better type safety
export interface DatabaseColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  foreignKeyReference?: {
    table: string;
    column: string;
  };
}

export interface DatabaseTable {
  name: string;
  schema: string;
  columns: DatabaseColumn[];
  primaryKeys: string[];
  foreignKeys: Array<{
    column: string;
    referencedTable: string;
    referencedColumn: string;
  }>;
  rowCount?: number;
}

// Type guards for runtime type checking
export const isTableRow = (value: unknown): value is TableRow => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export const isTableRowArray = (value: unknown): value is TableRow[] => {
  return Array.isArray(value) && value.every(isTableRow);
};

export const isStrictApiResponse = <T>(value: unknown): value is StrictApiResponse<T> => {
  return (
    typeof value === "object" &&
    value !== null &&
    "success" in value &&
    typeof (value as Record<string, unknown>).success === "boolean"
  );
};

// Utility types for data transformation
export type TableData = TableRow[];

export interface TableDisplayProps {
  data: TableData;
  columns: UIColumnDefinition[];
  isLoading?: boolean;
  error?: string;
}

// Enhanced filter state with proper typing
export interface TableFilterState {
  currentOffset: number;
  whereInput: string;
  orderByInput: string;
  pageSize: number;
  displaySize: number;
  columns?: ColumnDefinition[];
  totalRows?: number;
}
