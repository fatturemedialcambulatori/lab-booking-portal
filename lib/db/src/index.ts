import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const poolMax = Number(process.env.DATABASE_POOL_MAX ?? "1");

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 1,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
