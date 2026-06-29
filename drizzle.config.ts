import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dbCredentials: { url },
});
