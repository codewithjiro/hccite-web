import { type Config } from "drizzle-kit";

// Schema generation and migration-history checks do not connect to PostgreSQL.
// Commands that access a database must use the real connection string from env.
const databaseUrl = process.env.DATABASE_URL;
const databaseCommand = process.argv.some((argument) => ["migrate", "push", "studio", "introspect", "up"].includes(argument));
if (databaseCommand && !databaseUrl) throw new Error("DATABASE_URL is required for Drizzle database operations. Set it in your environment.");

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
  tablesFilter: ["hccite_*"],
} satisfies Config;
