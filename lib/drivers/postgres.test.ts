import type { Pool, PoolClient, QueryArrayResult } from "pg";
import { describe, expect, it, vi } from "vitest";
import { AI_READ_ONLY_ERROR_MESSAGE, AiReadOnlyQueryCleanupError } from "./ai-query";
import { PostgresDriver } from "./postgres";
import type { ConnectionConfig } from "./types";

const config: ConnectionConfig = {
  id: "test",
  name: "test",
  type: "postgres",
  host: "localhost",
  port: 5432,
  database: "test",
  username: "test",
  password: "test",
  ssl: false,
};

function result(rows: unknown[][] = [], command = "SELECT"): QueryArrayResult<unknown[]> {
  return {
    command,
    rowCount: rows.length,
    oid: 0,
    fields: rows.length
      ? [
          {
            name: "value",
            tableID: 0,
            columnID: 0,
            dataTypeID: 23,
            dataTypeSize: 4,
            dataTypeModifier: -1,
            format: "text",
          },
        ]
      : [],
    rows,
  };
}

function fakeDriver(
  execute: (sql: string | { text: string; queryMode?: string; rowMode?: string }) => Promise<unknown>,
) {
  const release = vi.fn();
  const query = vi.fn(execute);
  const client = { query, release } as unknown as PoolClient;
  const poolQuery = vi.fn();
  const connect = vi.fn(async () => client);
  const pool = { connect, query: poolQuery } as unknown as Pool;
  return { driver: new PostgresDriver(config, pool), connect, poolQuery, query, release };
}

function sqlText(query: string | { text: string }): string {
  return typeof query === "string" ? query : query.text;
}

describe("PostgresDriver.runAiReadOnlyQuery", () => {
  it("runs a read in a timed, read-only transaction and releases the client", async () => {
    const fake = fakeDriver(async (query) => {
      if (typeof query !== "string") return result([[1]]);
      return result([], query.split(" ")[0]);
    });

    await expect(fake.driver.runAiReadOnlyQuery("SELECT 1", 10)).resolves.toMatchObject({
      rows: [[1]],
      rowCount: 1,
      truncated: false,
    });

    expect(fake.query.mock.calls.map(([query]) => sqlText(query))).toEqual([
      "BEGIN TRANSACTION READ ONLY",
      "SET LOCAL statement_timeout = '15000ms'",
      "SET LOCAL lock_timeout = '1000ms'",
      "SET LOCAL idle_in_transaction_session_timeout = '5000ms'",
      "SELECT 1",
      "COMMIT",
    ]);
    expect(fake.query.mock.calls[4][0]).toMatchObject({
      text: "SELECT 1",
      rowMode: "array",
      queryMode: "extended",
    });
    expect(fake.release).toHaveBeenCalledOnce();
    expect(fake.release).toHaveBeenCalledWith();
  });

  it("maps PostgreSQL read-only violations to a user-safe error, rolls back, and releases", async () => {
    const readOnlyError = Object.assign(new Error("database detail that should not escape"), {
      code: "25006",
    });
    const fake = fakeDriver(async (query) => {
      if (sqlText(query).startsWith("SELECT nextval")) throw readOnlyError;
      return result();
    });

    await expect(fake.driver.runAiReadOnlyQuery("SELECT nextval('some_sequence')")).rejects.toThrow(
      AI_READ_ONLY_ERROR_MESSAGE,
    );
    expect(fake.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(fake.release).toHaveBeenCalledOnce();
  });

  it("rolls back and releases after a statement timeout", async () => {
    const timeout = Object.assign(new Error("canceling statement due to statement timeout"), {
      code: "57014",
    });
    const fake = fakeDriver(async (query) => {
      if (sqlText(query) === "SELECT slow_function()") throw timeout;
      return result();
    });

    await expect(fake.driver.runAiReadOnlyQuery("SELECT slow_function()"))
      .rejects.toThrow("statement timeout");
    expect(fake.query.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(fake.release).toHaveBeenCalledOnce();
  });

  it("does not acquire a client for rejected or malformed SQL", async () => {
    const fake = fakeDriver(async () => result());

    await expect(fake.driver.runAiReadOnlyQuery("DELETE FROM items")).rejects.toThrow(
      AI_READ_ONLY_ERROR_MESSAGE,
    );
    await expect(fake.driver.runAiReadOnlyQuery("SELECT FROM WHERE")).rejects.toThrow(
      AI_READ_ONLY_ERROR_MESSAGE,
    );
    expect(fake.connect).not.toHaveBeenCalled();
    expect(fake.release).not.toHaveBeenCalled();
  });

  it("surfaces rollback failure and destroys the unsafe pooled client", async () => {
    const queryError = new Error("query failed");
    const rollbackError = new Error("rollback failed");
    const fake = fakeDriver(async (query) => {
      const sql = sqlText(query);
      if (sql === "SELECT broken()") throw queryError;
      if (sql === "ROLLBACK") throw rollbackError;
      return result();
    });

    await expect(fake.driver.runAiReadOnlyQuery("SELECT broken()"))
      .rejects.toBeInstanceOf(AiReadOnlyQueryCleanupError);
    expect(fake.release).toHaveBeenCalledOnce();
    expect(fake.release).toHaveBeenCalledWith(rollbackError);
  });
});

describe("PostgresDriver.runQuery", () => {
  it("keeps the notebook/general query path writable and separate", async () => {
    const fake = fakeDriver(async () => result());
    fake.poolQuery.mockResolvedValue(result([], "UPDATE"));

    await expect(fake.driver.runQuery("UPDATE items SET name = 'human edit'"))
      .resolves.toMatchObject({ rowCount: 0 });
    expect(fake.poolQuery).toHaveBeenCalledWith({
      text: "UPDATE items SET name = 'human edit'",
      rowMode: "array",
    });
    expect(fake.connect).not.toHaveBeenCalled();
  });
});
