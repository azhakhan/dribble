/**
 * Parse a database connection URL (e.g. one copied from Neon, Supabase, RDS)
 * into the individual fields the connection form uses.
 *
 * Supported: postgres:// and postgresql:// URLs, with optional port,
 * percent-encoded credentials, and an sslmode query param.
 */

export interface ParsedConnectionString {
  type: "postgres";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

const POSTGRES_SCHEMES = ["postgres:", "postgresql:"];

export function parseConnectionString(raw: string): ParsedConnectionString | null {
  const input = raw.trim();
  if (!input.includes("://")) return null;

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }

  if (!POSTGRES_SCHEMES.includes(url.protocol)) return null;
  if (!url.hostname) return null;

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const sslmode = url.searchParams.get("sslmode");

  return {
    type: "postgres",
    host: url.hostname,
    port: url.port ? Number(url.port) : 5432,
    database,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    // Hosted providers default to requiring SSL; only an explicit
    // sslmode=disable/allow opts out.
    ssl: sslmode !== "disable" && sslmode !== "allow",
  };
}

/** True if the text looks like an attempted connection URL (worth warning on parse failure). */
export function looksLikeConnectionString(raw: string): boolean {
  return raw.includes("://");
}
