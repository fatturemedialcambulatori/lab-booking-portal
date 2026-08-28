import { drizzle } from "drizzle-orm/node-postgres";
import pg, { type PoolConfig } from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const rawDatabaseUrl = process.env.DATABASE_URL?.trim();
const databaseUrl = rawDatabaseUrl?.replace(/^(['"])(.*)\1$/, "$2");
const poolMax = Number(process.env.DATABASE_POOL_MAX ?? "1");
const sslRejectUnauthorizedEnv =
  process.env.DATABASE_SSL_REJECT_UNAUTHORIZED?.trim().toLowerCase();
const rejectUnauthorized =
  sslRejectUnauthorizedEnv === undefined
    ? process.env.NODE_ENV === "production"
    : sslRejectUnauthorizedEnv !== "false";

const buildConnectionConfig = (
  connectionString: string,
): Pick<PoolConfig, "connectionString" | "ssl"> => {
  try {
    const url = new URL(connectionString);
    const sslMode = url.searchParams.get("sslmode");
    const isSupabaseHost = url.hostname.includes("supabase.com");
    const requiresSsl =
      (sslMode !== null && sslMode !== "disable") || isSupabaseHost;

    if (sslMode !== null) {
      url.searchParams.delete("sslmode");
    }

    return {
      connectionString: url.toString(),
      ssl: requiresSsl ? { rejectUnauthorized } : undefined,
    };
  } catch {
    return { connectionString };
  }
};

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  ...buildConnectionConfig(databaseUrl),
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
