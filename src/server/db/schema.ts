import { pgTableCreator } from "drizzle-orm/pg-core";

// Domain tables are introduced in Phase 03.
export const createTable = pgTableCreator((name) => `hccite_${name}`);
