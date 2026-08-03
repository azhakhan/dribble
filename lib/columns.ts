/**
 * The families a SQL type falls into. Drives the header icon a column gets and
 * whether its cells are right-aligned.
 */
export type ColumnCategory =
  | "number"
  | "text"
  | "boolean"
  | "date"
  | "time"
  | "timestamp"
  | "interval"
  | "uuid"
  | "json"
  | "array"
  | "binary"
  | "network"
  | "geo"
  | "other";

/**
 * Keyed by the type name with any modifier stripped. Covers both spellings we
 * see: `format_type()` names from the catalog (`character varying`, `integer`)
 * and the short internal names the wire protocol's OIDs map to (`varchar`,
 * `int4`), since ad-hoc query results only carry the latter.
 */
const CATEGORY_BY_TYPE: Record<string, ColumnCategory> = {
  smallint: "number",
  integer: "number",
  bigint: "number",
  int: "number",
  int2: "number",
  int4: "number",
  int8: "number",
  decimal: "number",
  numeric: "number",
  real: "number",
  "double precision": "number",
  float: "number",
  float4: "number",
  float8: "number",
  smallserial: "number",
  serial: "number",
  bigserial: "number",
  money: "number",
  oid: "number",

  text: "text",
  varchar: "text",
  "character varying": "text",
  char: "text",
  character: "text",
  bpchar: "text",
  name: "text",
  citext: "text",
  xml: "text",

  boolean: "boolean",
  bool: "boolean",

  date: "date",

  time: "time",
  timetz: "time",
  "time without time zone": "time",
  "time with time zone": "time",

  timestamp: "timestamp",
  timestamptz: "timestamp",
  "timestamp without time zone": "timestamp",
  "timestamp with time zone": "timestamp",

  interval: "interval",
  uuid: "uuid",

  json: "json",
  jsonb: "json",

  bytea: "binary",

  inet: "network",
  cidr: "network",
  macaddr: "network",
  macaddr8: "network",

  point: "geo",
  line: "geo",
  lseg: "geo",
  box: "geo",
  path: "geo",
  polygon: "geo",
  circle: "geo",
  geometry: "geo",
  geography: "geo",
};

/**
 * Classifies a SQL type name. Unknown types (enums, domains, extension types)
 * fall through to `other` rather than guessing.
 */
export function columnCategory(dataType: string): ColumnCategory {
  const t = dataType.trim().toLowerCase();
  if (t === "array" || t.endsWith("[]")) return "array";
  // Drop precision/scale modifiers: `numeric(10,2)`, `timestamp(6) with time zone`.
  const base = t.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  return CATEGORY_BY_TYPE[base] ?? "other";
}

/**
 * Maps display position → index into the source columns, honouring a saved
 * column order. Names not present in the result are ignored; result columns
 * missing from the order are appended in native order.
 */
export function columnDisplayOrder(columnNames: string[], order?: string[]): number[] {
  const byName = new Map(columnNames.map((name, i) => [name, i]));
  const seen = new Set<number>();
  const out: number[] = [];
  if (order) {
    for (const name of order) {
      const idx = byName.get(name);
      if (idx !== undefined && !seen.has(idx)) {
        seen.add(idx);
        out.push(idx);
      }
    }
  }
  for (let i = 0; i < columnNames.length; i++) {
    if (!seen.has(i)) out.push(i);
  }
  return out;
}
