import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireOwnedRecord } from "~/server/auth";
import { getDb } from "~/server/db";
import { resources, studies, studyRelatedSources } from "~/server/db/schema";
import { discoverySaveLocatorSchema } from "~/server/discovery/locator";
import { resolveDiscoveredResource } from "~/server/discovery/save";
import { lookupCrossrefDoi } from "~/server/discovery/providers/crossref";
import { mergeNormalizedResources, normalizedResourceSchema } from "~/server/discovery/normalization";
import { relevanceSchema } from "~/server/literature/core";
import { explainRelevance } from "~/server/literature/relevance";
import { getCurrentUserProfile } from "./profiles";
import { getOwnedStudyProfile } from "./studies";
import { upsertDiscoveryResource } from "./resources";
import { ensureResourceIntegrity } from "~/server/integrity/service";

const idSchema = z.string().uuid();
export const selectionSchema = z.object({ associationId: z.string().uuid(), selected: z.boolean() }).strict();

export async function listStudyRelatedSources(studyId: string) {
  const id = idSchema.parse(studyId), owner = await getCurrentUserProfile(), db = getDb();
  const [study] = await db.select().from(studies).where(and(eq(studies.id, id), eq(studies.userId, owner.id))).limit(1);
  requireOwnedRecord(study, owner.id);
  const rows = await db.select({ association: studyRelatedSources, resource: resources }).from(studyRelatedSources)
    .innerJoin(resources, eq(resources.id, studyRelatedSources.resourceId))
    .where(eq(studyRelatedSources.studyId, id)).orderBy(desc(studyRelatedSources.updatedAt));
  // Opening Source Health checks/reuses at the server boundary. Fresh records do
  // not issue a provider request, so React renders cannot create provider loops.
  return Promise.all(rows.map(async (row) => ({ ...row, integrity: (await ensureResourceIntegrity(row.resource.id)).check })));
}

export async function associateLiteratureSource(studyId: string, locator: unknown, dependencies = { resolve: resolveDiscoveredResource, upsert: upsertDiscoveryResource, relevance: explainRelevance, crossref: lookupCrossrefDoi }) {
  const id = idSchema.parse(studyId), validLocator = discoverySaveLocatorSchema.parse(locator);
  const data = await getOwnedStudyProfile(id);
  if (data.study.status !== "ready" || !data.profile) throw new Error("A ready saved Study Profile is required.");
  let authoritative = normalizedResourceSchema.parse(await dependencies.resolve(validLocator));
  if (authoritative.source !== validLocator.provider || authoritative.sourceIdentifier !== validLocator.providerIdentifier) throw new Error("Provider record identity did not match the requested locator.");
  if (validLocator.provider === "openalex" && authoritative.doi) {
    try { authoritative = mergeNormalizedResources(authoritative, (await dependencies.crossref(authoritative.doi)).resource); }
    catch { /* Crossref enrichment is optional; preserve the authoritative discovery record. */ }
  }
  const canonical = await dependencies.upsert(authoritative);
  const db = getDb();
  const [created] = await db.insert(studyRelatedSources).values({ studyId: id, resourceId: canonical.resource.id }).onConflictDoNothing({ target: [studyRelatedSources.studyId, studyRelatedSources.resourceId] }).returning();
  let association = created;
  if (!association) [association] = await db.select().from(studyRelatedSources).where(and(eq(studyRelatedSources.studyId, id), eq(studyRelatedSources.resourceId, canonical.resource.id))).limit(1);
  if (!association) throw new Error("Could not associate this source.");
  let relevanceUnavailable = false;
  if (!association.relevanceReason) {
    try {
      const generated = await dependencies.relevance(data.profile, normalizedResourceSchema.parse({ ...canonical.resource, retrievedAt: canonical.resource.retrievedAt ?? canonical.resource.createdAt }));
      const relevance = relevanceSchema.parse({ reason: generated.reason, score: generated.score });
      [association] = await db.update(studyRelatedSources).set({ relevanceReason: relevance.reason, relevanceScore: relevance.score, updatedAt: new Date() }).where(and(eq(studyRelatedSources.id, association.id), eq(studyRelatedSources.studyId, id))).returning();
    } catch { relevanceUnavailable = true; }
  }
  return { association, resource: canonical.resource, reused: canonical.reused, relevanceUnavailable };
}

export async function setLiteratureSelection(studyId: string, input: unknown) {
  const id = idSchema.parse(studyId), patch = selectionSchema.parse(input), owner = await getCurrentUserProfile(), db = getDb();
  const [study] = await db.select().from(studies).where(and(eq(studies.id, id), eq(studies.userId, owner.id))).limit(1);
  requireOwnedRecord(study, owner.id);
  const [existing] = await db.select().from(studyRelatedSources).where(and(eq(studyRelatedSources.id, patch.associationId), eq(studyRelatedSources.studyId, id))).limit(1);
  if (!existing) return null;
  if (existing.selectedForRrl === patch.selected) {
    const integrity = patch.selected ? await ensureResourceIntegrity(existing.resourceId) : null;
    return { association: existing, integrity };
  }
  const [updated] = await db.update(studyRelatedSources).set({ selectedForRrl: patch.selected, updatedAt: new Date() }).where(and(eq(studyRelatedSources.id, existing.id), eq(studyRelatedSources.studyId, id))).returning();
  if (!updated) return null;
  // Selection stays durable even if Crossref is unavailable; the integrity service
  // returns a retryable/stale result rather than undoing the user choice.
  return { association: updated, integrity: patch.selected ? await ensureResourceIntegrity(updated.resourceId) : null };
}

export async function refreshStudyRelatedSourceIntegrity(studyId: string, associationId: string) {
  const id = idSchema.parse(studyId), associationKey = idSchema.parse(associationId), owner = await getCurrentUserProfile(), db = getDb();
  const [study] = await db.select().from(studies).where(and(eq(studies.id, id), eq(studies.userId, owner.id))).limit(1);
  requireOwnedRecord(study, owner.id);
  const [association] = await db.select().from(studyRelatedSources).where(and(eq(studyRelatedSources.id, associationKey), eq(studyRelatedSources.studyId, id))).limit(1);
  if (!association) return null;
  return { association, integrity: await ensureResourceIntegrity(association.resourceId, { force: true }) };
}
