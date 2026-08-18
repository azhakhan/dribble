import { describe, expect, it } from "vitest";
import {
  AI_READ_ONLY_ERROR_MESSAGE,
  AiReadOnlyQueryError,
  assertAiSelectQuery,
} from "./ai-query";

describe("assertAiSelectQuery", () => {
  it.each([
    "SELECT 1",
    "SELECT ';' AS semicolon;",
    "/* inspect */ WITH rows AS (SELECT 1 AS id) SELECT * FROM rows",
    "WITH RECURSIVE nums(n) AS (VALUES (1) UNION ALL SELECT n + 1 FROM nums WHERE n < 3) SELECT * FROM nums",
    "EXPLAIN SELECT 1",
    "EXPLAIN (ANALYZE false, VERBOSE true, FORMAT JSON) SELECT 1",
    "EXPLAIN ANALYZE VERBOSE WITH rows AS (SELECT 1) SELECT * FROM rows",
  ])("accepts a single read-only statement: %s", (sql) => {
    expect(() => assertAiSelectQuery(sql)).not.toThrow();
  });

  it.each([
    "INSERT INTO items VALUES (1)",
    "UPDATE items SET name = 'changed'",
    "DELETE FROM items",
    "CREATE TABLE items (id integer)",
    "ALTER TABLE items ADD COLUMN name text",
    "DROP TABLE items",
    "TRUNCATE items",
    "COPY items TO STDOUT",
    "BEGIN",
    "COMMIT",
    "ROLLBACK",
    "SELECT 1; SELECT 2",
    "WITH changed AS (INSERT INTO items VALUES (1) RETURNING *) SELECT * FROM changed",
    "WITH changed AS (UPDATE items SET name = 'changed' RETURNING *) SELECT * FROM changed",
    "WITH changed AS (DELETE FROM items RETURNING *) SELECT * FROM changed",
    "EXPLAIN ANALYZE DELETE FROM items",
    "EXPLAIN (ANALYZE true) UPDATE items SET name = 'changed'",
    "SELECT * INTO copied_items FROM items",
  ])("rejects a statement outside the AI boundary: %s", (sql) => {
    expect(() => assertAiSelectQuery(sql)).toThrowError(AiReadOnlyQueryError);
    expect(() => assertAiSelectQuery(sql)).toThrowError(AI_READ_ONLY_ERROR_MESSAGE);
  });

  it("rejects malformed SQL with the same user-safe boundary error", () => {
    expect(() => assertAiSelectQuery("SELECT FROM WHERE")).toThrowError(AI_READ_ONLY_ERROR_MESSAGE);
  });
});
