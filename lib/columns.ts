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
