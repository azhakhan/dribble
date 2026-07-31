/** RFC 4180 CSV serialization, shared by the client-side and streaming exports. */

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One CSV record, CRLF-terminated. */
export function csvRow(values: unknown[]): string {
  return values.map(csvCell).join(",") + "\r\n";
}

/** A full CSV document: header row followed by the data rows. */
export function toCsv(header: string[], rows: unknown[][]): string {
  return csvRow(header) + rows.map(csvRow).join("");
}
