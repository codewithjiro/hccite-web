import { type Config } from "drizzle-kit";

import { requireServerEnv } from "./src/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: requireServerEnv("DATABASE_URL"),
  },
  tablesFilter: ["hccite_*"],
} satisfies Config;
