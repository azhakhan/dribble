import { Pool, type FieldDef } from "pg";
import type {
  ColumnInfo,
  ConnectionConfig,
  DatabaseDriver,
  PagedQueryParams,
  PagedQueryResult,
  QueryResult,
  TableDataParams,
  TableDataResult,
} from "./types";

const OID_NAMES: Record<number, string> = {
  16: "bool",
  17: "bytea",
  20: "int8",
  21: "int2",
  23: "int4",
  25: "text",
  114: "json",
  700: "float4",
  701: "float8",
  1042: "char",
  1043: "varchar",
  1082: "date",
  1083: "time",
  1114: "timestamp",
  1184: "timestamptz",
  1700: "numeric",
  2950: "uuid",
  3802: "jsonb",
};

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Returns the query stripped of a trailing semicolon if it can be safely wrapped
 * in `SELECT * FROM (...)` for LIMIT/OFFSET paging, or null if it can't (multiple
 * statements, or anything other than a SELECT / WITH query). A `;` inside a string
 * literal conservatively disables paging — the query still runs, just unpaged.
 */
function pageableSql(sql: string): string | null {
  let s = sql.trim();
  if (s.endsWith(";")) s = s.slice(0, -1).trim();
  if (!s || s.includes(";")) return null;
  if (!/^(with|select)\b/i.test(s)) return null;
  return s;
}

function jsonSafe(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "bigint") return v.toString();
  if (v instanceof Date) return v.toISOString();
  if (Buffer.isBuffer(v)) return `\\x${v.toString("hex").slice(0, 256)}`;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

const MAX_ROWS = 1000;

export class PostgresDriver implements DatabaseDriver {
  readonly type = "postgres" as const;
  private pool: Pool;

  constructor(cfg: ConnectionConfig) {
    this.pool = new Pool({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.username,
      password: cfg.password,
      ssl: cfg.ssl ? { rejectUnauthorized: false } : undefined,
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      statement_timeout: 60_000,
      allowExitOnIdle: true,
    });
    this.pool.on("error", () => {
      /* keep idle-client errors from crashing the process */
    });
  }

  async listSchemas(): Promise<string[]> {
    const res = await this.pool.query(
      `SELECT schema_name FROM information_schema.schemata
       WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')
       ORDER BY schema_name`
    );
    return res.rows.map((r) => r.schema_name);
  }

  async listTables(schema: string): Promise<{ name: string; kind: "table" | "view" }[]> {
    const res = await this.pool.query(
      `SELECT table_name, table_type FROM information_schema.tables
       WHERE table_schema = $1 ORDER BY table_name`,
      [schema]
    );
    return res.rows.map((r) => ({
      name: r.table_name,
      kind: r.table_type === "VIEW" ? "view" : "table",
    }));
  }

  async listColumns(schema: string, table: string): Promise<ColumnInfo[]> {
    const res = await this.pool.query(
      `SELECT column_name, data_type FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
      [schema, table]
    );
    return res.rows.map((r) => ({ name: r.column_name, dataType: r.data_type }));
  }

  async getTableData(p: TableDataParams): Promise<TableDataResult> {
    const rel = `${quoteIdent(p.schema)}.${quoteIdent(p.table)}`;
    const where = p.where?.trim() ? ` WHERE ${p.where.trim()}` : "";

    let orderBy = "";
    if (p.sortColumn) {
      // Validate the sort column against real columns to keep identifier quoting sound.
      const cols = await this.listColumns(p.schema, p.table);
      if (cols.some((c) => c.name === p.sortColumn)) {
        orderBy = ` ORDER BY ${quoteIdent(p.sortColumn)} ${p.sortDir === "desc" ? "DESC" : "ASC"}`;
      }
    }

    const limit = Math.min(Math.max(p.limit, 1), MAX_ROWS);
    const sql = `SELECT * FROM ${rel}${where}${orderBy} LIMIT ${limit} OFFSET ${Math.max(p.offset, 0)}`;
    const result = await this.runQuery(sql, limit);

    let totalCount: number | null = null;
    try {
      const cnt = await this.pool.query(`SELECT count(*)::int8 AS n FROM ${rel}${where}`);
      totalCount = Number(cnt.rows[0].n);
    } catch {
      // count can fail (e.g. permissions) without blocking the data fetch
    }
    return { ...result, totalCount };
  }

  async runPagedQuery(sql: string, p: PagedQueryParams): Promise<PagedQueryResult> {
    const pageable = pageableSql(sql);
    const limit = Math.min(Math.max(p.limit, 1), MAX_ROWS);
    const offset = Math.max(p.offset, 0);

    // Non-SELECT, multi-statement, or DDL — can't be wrapped, so run as-is.
    if (!pageable) {
      const res = await this.runQuery(sql);
      return { ...res, totalCount: null, paged: false };
    }

    const sub = `(${pageable}) AS _dribble_sub`;
    const result = await this.runQuery(
      `SELECT * FROM ${sub} LIMIT ${limit} OFFSET ${offset}`,
      limit,
    );

    let totalCount: number | null = null;
    if (p.withCount) {
      try {
        const cnt = await this.pool.query(`SELECT count(*)::int8 AS n FROM ${sub}`);
        totalCount = Number(cnt.rows[0].n);
      } catch {
        // count can fail (e.g. permissions); paging still works without a total
      }
    }
    return { ...result, totalCount, paged: true };
  }

  async runQuery(sql: string, maxRows = MAX_ROWS): Promise<QueryResult> {
    const started = Date.now();
    const res = await this.pool.query({ text: sql, rowMode: "array" });
    const durationMs = Date.now() - started;

    // Multi-statement queries return an array of results; show the last one with rows.
    const results = Array.isArray(res) ? res : [res];
    const withRows = [...results].reverse().find((r) => r.fields?.length) ?? results[results.length - 1];

    const columns: ColumnInfo[] = (withRows.fields ?? []).map((f: FieldDef) => ({
      name: f.name,
      dataType: OID_NAMES[f.dataTypeID] ?? `oid:${f.dataTypeID}`,
    }));
    const allRows = (withRows.rows ?? []) as unknown[][];
    const truncated = allRows.length > maxRows;
    const rows = allRows.slice(0, maxRows).map((row) => row.map(jsonSafe));
    return {
      columns,
      rows,
      rowCount: withRows.rowCount ?? rows.length,
      durationMs,
      truncated,
    };
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}
