import { z } from "zod";
import type { PagedQueryResult } from "@/lib/drivers/types";

// Shapes stored in JSONB columns of the metadata DB. Kept free of any runtime
// client/server-only imports so both the Drizzle schema (server) and UI can use them.

/** One SQL cell in a notebook. */
export interface Cell {
  id: string;
  sql: string;
}

export const CellSchema = z.object({
  id: z.string(),
  sql: z.string(),
});

/** A persisted page of results for one notebook cell (keyed by cell id). */
export interface CellSnapshot {
  result: PagedQueryResult | null;
  sql: string;
  page: number;
  limit: number;
  totalCount: number | null;
  ranAt: string;
}

export type CellResults = Record<string, CellSnapshot>;
