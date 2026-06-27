export type DatabaseType = "postgres"; // future: "mysql" | "snowflake" | ...

export interface ConnectionConfig {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

export interface ColumnInfo {
  name: string;
  dataType: string;
}

export interface QueryResult {
  columns: ColumnInfo[];
  /** Row-major values, JSON-safe (dates as ISO strings etc.). */
  rows: unknown[][];
  rowCount: number;
  durationMs: number;
  truncated: boolean;
}

export interface TableDataParams {
  schema: string;
  table: string;
  limit: number;
  offset: number;
  sortColumn?: string;
  sortDir?: "asc" | "desc";
  /** Raw WHERE clause (without the WHERE keyword), DataGrip-style. */
  where?: string;
}

export interface TableDataResult extends QueryResult {
  totalCount: number | null;
}

export interface DatabaseDriver {
  readonly type: DatabaseType;
  listSchemas(): Promise<string[]>;
  listTables(schema: string): Promise<{ name: string; kind: "table" | "view" }[]>;
  listColumns(schema: string, table: string): Promise<ColumnInfo[]>;
  getTableData(params: TableDataParams): Promise<TableDataResult>;
  runQuery(sql: string, maxRows?: number): Promise<QueryResult>;
  end(): Promise<void>;
}
