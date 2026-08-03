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
  /** Catalog-only metadata — absent for columns synthesised by an ad-hoc query. */
  nullable?: boolean;
  isPrimaryKey?: boolean;
  isForeignKey?: boolean;
  /** For a foreign key, the referenced `schema.table.column`. */
  references?: string;
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

export interface TableStreamParams {
  schema: string;
  table: string;
  sortColumn?: string;
  sortDir?: "asc" | "desc";
  /** Raw WHERE clause (without the WHERE keyword). */
  where?: string;
  /** Column names to emit, in order. Unknown names are dropped; absent = every column. */
  columns?: string[];
}

/** An open, unbounded read over a table — used to export more rows than a query returns. */
export interface TableRowStream {
  /** Columns in the order rows are emitted. */
  columns: ColumnInfo[];
  /** Successive row batches until the table is exhausted. */
  batches(): AsyncGenerator<unknown[][]>;
  /** Release the underlying resources. Safe to call more than once. */
  close(): Promise<void>;
}

export interface PagedQueryParams {
  limit: number;
  offset: number;
  /** Run a count(*) over the query to populate totalCount (do this once, then reuse while paging). */
  withCount: boolean;
}

export interface PagedQueryResult extends QueryResult {
  /** Total rows the query produces, or null if uncounted / non-pageable. */
  totalCount: number | null;
  /** True when the result was served via server-side LIMIT/OFFSET paging. */
  paged: boolean;
}

export interface DatabaseDriver {
  readonly type: DatabaseType;
  listSchemas(): Promise<string[]>;
  listTables(schema: string): Promise<{ name: string; kind: "table" | "view" }[]>;
  listColumns(schema: string, table: string): Promise<ColumnInfo[]>;
  getTableData(params: TableDataParams): Promise<TableDataResult>;
  /** Open a batched read over a whole table. Rejects if the query is invalid. */
  openTableStream(params: TableStreamParams): Promise<TableRowStream>;
  runQuery(sql: string, maxRows?: number): Promise<QueryResult>;
  /** Run an arbitrary user query with server-side pagination (and optional total count). */
  runPagedQuery(sql: string, params: PagedQueryParams): Promise<PagedQueryResult>;
  end(): Promise<void>;
}
