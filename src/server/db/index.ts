import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { requireServerEnv } from "~/env";
import * as schema from "./schema";

/**
 * Cache the database connection in development. This avoids creating a new connection on every HMR
 * update.
 */
const globalForDb = globalThis as unknown as {
  conn: postgres.Sql | undefined;
};

export function getDb() {
  const conn = globalForDb.conn ?? postgres(requireServerEnv("DATABASE_URL"));
  if (process.env.NODE_ENV !== "production") globalForDb.conn = conn;
  return drizzle(conn, { schema });
}

/** Close the cached connection when a short-lived integration-test process exits. */
export async function closeDb() {
  const conn = globalForDb.conn;
  if (conn) {
    globalForDb.conn = undefined;
    await conn.end();
  }
}
