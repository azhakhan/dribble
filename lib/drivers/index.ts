import type { ConnectionConfig, DatabaseDriver, DatabaseType } from "./types";
import { PostgresDriver } from "./postgres";

type DriverFactory = (cfg: ConnectionConfig) => DatabaseDriver;

// Add new database types here (mysql, snowflake, ...).
const REGISTRY: Record<DatabaseType, DriverFactory> = {
  postgres: (cfg) => new PostgresDriver(cfg),
};

export const SUPPORTED_TYPES = Object.keys(REGISTRY) as DatabaseType[];

export function createDriver(cfg: ConnectionConfig): DatabaseDriver {
  const factory = REGISTRY[cfg.type];
  if (!factory) throw new Error(`Unsupported database type: ${cfg.type}`);
  return factory(cfg);
}

export * from "./types";
