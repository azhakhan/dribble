import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AI_READ_ONLY_ERROR_MESSAGE } from "./ai-query";
import { PostgresDriver } from "./postgres";
import type { ConnectionConfig } from "./types";

const connectionString = process.env.TEST_DATABASE_URL;
const integration = connectionString ? describe : describe.skip;

integration("PostgresDriver AI read-only integration", () => {
  const suffix = randomUUID().replaceAll("-", "");
  const table = `dribble_ai_read_only_${suffix}`;
  const sequence = `${table}_seq`;
  let pool: Pool;
  let driver: PostgresDriver;

  beforeAll(async () => {
    pool = new Pool({ connectionString, max: 2 });
    const config: ConnectionConfig = {
      id: "integration",
      name: "integration",
      type: "postgres",
      host: "unused",
      port: 5432,
      database: "unused",
      username: "unused",
      password: "unused",
      ssl: false,
    };
    driver = new PostgresDriver(config, pool);
    await driver.runQuery(`CREATE TABLE ${table} (id integer PRIMARY KEY, value text)`);
    await driver.runQuery(`INSERT INTO ${table} VALUES (1, 'notebook write')`);
    await driver.runQuery(`CREATE SEQUENCE ${sequence}`);
  });

  afterAll(async () => {
    await driver.runQuery(`DROP TABLE IF EXISTS ${table}`);
    await driver.runQuery(`DROP SEQUENCE IF EXISTS ${sequence}`);
    await driver.end();
  });

  it.each([
    ["SELECT", `SELECT * FROM ${table}`],
    ["WITH SELECT", `WITH rows AS (SELECT * FROM ${table}) SELECT * FROM rows`],
    ["EXPLAIN SELECT", `EXPLAIN SELECT * FROM ${table}`],
  ])("allows %s and releases its client", async (_label, sql) => {
    await expect(driver.runAiReadOnlyQuery(sql)).resolves.toMatchObject({ truncated: false });
    expect(pool.waitingCount).toBe(0);
    expect(pool.idleCount).toBe(pool.totalCount);
  });

  it("actually runs with PostgreSQL read-only mode and local timeouts", async () => {
    const result = await driver.runAiReadOnlyQuery(
      `SELECT current_setting('transaction_read_only'),
              current_setting('statement_timeout'),
              current_setting('lock_timeout'),
              current_setting('idle_in_transaction_session_timeout')`,
    );
    expect(result.rows).toEqual([["on", "15s", "1s", "5s"]]);
    expect(pool.idleCount).toBe(pool.totalCount);
  });

  it.each([
    ["INSERT", `INSERT INTO ${table} VALUES (2, 'ai write')`],
    ["UPDATE", `UPDATE ${table} SET value = 'ai write' WHERE id = 1`],
    ["DELETE", `DELETE FROM ${table} WHERE id = 1`],
    ["DDL", `ALTER TABLE ${table} ADD COLUMN changed boolean`],
    ["COPY", `COPY ${table} TO STDOUT`],
    ["writable CTE", `WITH changed AS (DELETE FROM ${table} RETURNING *) SELECT * FROM changed`],
    ["multiple statements", `SELECT 1; DELETE FROM ${table}`],
    ["transaction control", "COMMIT"],
  ])("rejects %s without leaking a client", async (_label, sql) => {
    await expect(driver.runAiReadOnlyQuery(sql)).rejects.toThrow(AI_READ_ONLY_ERROR_MESSAGE);
    expect(pool.waitingCount).toBe(0);
    expect(pool.idleCount).toBe(pool.totalCount);
  });

  it("has a database-enforced backstop for SELECT calls that attempt writes", async () => {
    await expect(driver.runAiReadOnlyQuery(`SELECT nextval('${sequence}')`)).rejects.toThrow(
      AI_READ_ONLY_ERROR_MESSAGE,
    );
    const value = await driver.runQuery(`SELECT last_value FROM ${sequence}`);
    expect(value.rows).toEqual([["1"]]);
    expect(pool.idleCount).toBe(pool.totalCount);
  });

  it("preserves writes through the general notebook API", async () => {
    await driver.runQuery(`UPDATE ${table} SET value = 'human changed' WHERE id = 1`);
    const value = await driver.runAiReadOnlyQuery(`SELECT value FROM ${table} WHERE id = 1`);
    expect(value.rows).toEqual([["human changed"]]);
  });
});
