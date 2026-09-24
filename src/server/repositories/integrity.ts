import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "~/server/db";
import { resourceIntegrityChecks, resources } from "~/server/db/schema";

const integrityInputSchema = z.object({
  resourceId: z.string().uuid(), status: z.enum(["no_known_issue", "review_required", "corrected", "retracted", "unknown"]),
  doiVerified: z.boolean().nullable().optional(), updateType: z.enum(["correction", "retraction", "expression_of_concern", "other"]).nullable().optional(),
  updateDoi: z.string().trim().max(512).nullable().optional(), updateLabel: z.string().max(10000).nullable().optional(),
  integritySource: z.enum(["openalex", "crossref", "google_books", "manual"]).nullable().optional(),
  metadataComplete: z.boolean().nullable().optional(), checkedAt: z.coerce.date().optional(), rawMetadataHash: z.string().max(128).nullable().optional(),
});

/** Integrity evidence belongs to shared canonical metadata; DOI verification remains a separate field. */
export async function recordIntegrityCheck(input: unknown) {
  const data = integrityInputSchema.parse(input), db = getDb();
  const [resource] = await db.select({ id: resources.id }).from(resources).where(eq(resources.id, data.resourceId)).limit(1);
  if (!resource) return null;
  const [row] = await db.insert(resourceIntegrityChecks).values(data).returning();
  return row;
}

/**
 * One current check is maintained per canonical Resource. PostgreSQL's advisory
 * lock serializes same-resource refreshes without a new infrastructure dependency.
 * Historical provider payloads are deliberately not stored.
 */
export async function recordLatestIntegrityCheck(input: unknown) {
  const data = integrityInputSchema.parse(input), db = getDb();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hccite:integrity:${data.resourceId}`}, 0))`);
    const [resource] = await tx.select({ id: resources.id }).from(resources).where(eq(resources.id, data.resourceId)).limit(1);
    if (!resource) return null;
    const [latest] = await tx.select().from(resourceIntegrityChecks).where(eq(resourceIntegrityChecks.resourceId, data.resourceId)).orderBy(desc(resourceIntegrityChecks.checkedAt)).limit(1);
    if (latest) {
      const [updated] = await tx.update(resourceIntegrityChecks).set(data).where(eq(resourceIntegrityChecks.id, latest.id)).returning();
      return updated ?? latest;
    }
    const [created] = await tx.insert(resourceIntegrityChecks).values(data).returning();
    return created ?? null;
  });
}

export async function getLatestIntegrityCheck(resourceId: string) {
  const id = z.string().uuid().parse(resourceId);
  const [row] = await getDb().select().from(resourceIntegrityChecks).where(eq(resourceIntegrityChecks.resourceId, id)).orderBy(desc(resourceIntegrityChecks.checkedAt)).limit(1);
  return row ?? null;
}

export async function listIntegrityChecks(resourceId: string) {
  const id = z.string().uuid().parse(resourceId);
  return getDb().select().from(resourceIntegrityChecks).where(eq(resourceIntegrityChecks.resourceId, id)).orderBy(desc(resourceIntegrityChecks.checkedAt));
}
