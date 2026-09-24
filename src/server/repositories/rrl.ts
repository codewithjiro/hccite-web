import "server-only";

import { createHash } from "node:crypto";
import { and, desc, eq, inArray, max } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwnedRecord } from "~/server/auth";
import { getDb } from "~/server/db";
import { resources, rrlAudits, rrlCitationLinks, rrlDraftSources, rrlDrafts, studies, studyRelatedSources } from "~/server/db/schema";
import { getCurrentUserProfile } from "./profiles";
import { extractCitationKeys } from "~/server/rrl/core";

const idSchema = z.string().uuid();
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const hashForContent = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");
export const createDraftSchema = z.object({
  studyId: idSchema, citationStyle: z.enum(["apa", "mla", "chicago"]), content: z.string().max(500000),
  draftVersion: z.number().int().positive().default(1), model: z.string().max(160).nullable().optional(),
  generationVersion: z.number().int().positive().default(1), selectedResourceIds: z.array(idSchema).max(1000).default([]),
});
const sourceSnapshotSchema = z.object({ resourceId: idSchema, citationKey: z.string().regex(/^HCCITE:S[1-9]\d*$/), sourceSnapshot: z.record(z.unknown()) });
export const citationLinkSchema = z.object({ citationKey: z.string().trim().min(1).max(160), resourceId: idSchema, sectionKey: z.string().max(160).nullable().optional(), contextSnippet: z.string().max(10000).nullable().optional() });
export const generatedDraftSchema = z.object({
  studyId: idSchema, citationStyle: z.enum(["apa", "mla", "chicago"]), content: z.string().min(1).max(500000), model: z.string().max(160), modelVersion: z.string().max(160).nullable().optional(), generationRequestId: idSchema,
  structuredContent: z.record(z.unknown()), integrityContext: z.array(z.record(z.unknown())).max(100), sources: z.array(sourceSnapshotSchema).min(1).max(1000), citationLinks: z.array(citationLinkSchema).max(10000),
});
export const auditSchema = z.object({
  draftVersion: z.number().int().positive(), draftContentHash: hashSchema, status: z.enum(["passed", "review_required", "failed"]),
  citationsTotal: z.number().int().nonnegative(), citationsMapped: z.number().int().nonnegative(), doisVerified: z.number().int().nonnegative(),
  retractedCount: z.number().int().nonnegative(), reviewRequiredCount: z.number().int().nonnegative(), duplicateCount: z.number().int().nonnegative(), unselectedReferenceCount: z.number().int().nonnegative(),
});

async function findOwnedDraft(draftId: string, profileId: string) {
  const db = getDb();
  const [row] = await db.select({ draft: rrlDrafts, userId: studies.userId }).from(rrlDrafts)
    .innerJoin(studies, eq(studies.id, rrlDrafts.studyId)).where(and(eq(rrlDrafts.id, draftId), eq(studies.userId, profileId))).limit(1);
  if (!row) notFound();
  requireOwnedRecord({ userId: row.userId }, profileId);
  return row.draft;
}

export async function createRrlDraft(input: unknown) {
  const data = createDraftSchema.parse(input), profile = await getCurrentUserProfile(), db = getDb();
  const [study] = await db.select({ id: studies.id }).from(studies).where(and(eq(studies.id, data.studyId), eq(studies.userId, profile.id))).limit(1);
  requireOwnedRecord(study && { ...study, userId: profile.id }, profile.id);
  const uniqueResourceIds = [...new Set(data.selectedResourceIds)];
  return db.transaction(async (tx) => {
    if (uniqueResourceIds.length) {
      const selected = await tx.select({ resourceId: studyRelatedSources.resourceId }).from(studyRelatedSources)
        .where(and(eq(studyRelatedSources.studyId, data.studyId), eq(studyRelatedSources.selectedForRrl, true), inArray(studyRelatedSources.resourceId, uniqueResourceIds)));
      if (selected.length !== uniqueResourceIds.length) throw new Error("Draft sources must be selected sources for this study.");
    }
    const [draft] = await tx.insert(rrlDrafts).values({
      studyId: data.studyId, citationStyle: data.citationStyle, content: data.content, contentHash: hashForContent(data.content),
      draftVersion: data.draftVersion, model: data.model, generationVersion: data.generationVersion,
    }).returning();
    if (uniqueResourceIds.length) await tx.insert(rrlDraftSources).values(uniqueResourceIds.map((resourceId, index) => ({ draftId: draft!.id, resourceId, citationKey: `HCCITE:S${index + 1}`, sourceSnapshot: { legacySnapshot: true, resourceId }, selectedAtGeneration: true })));
    return draft;
  });
}

/** Atomic Phase 10 persistence: selected sources are re-authorized immediately before snapshotting. */
export async function createGeneratedRrlDraft(input: unknown) {
  const data = generatedDraftSchema.parse(input), profile = await getCurrentUserProfile(), db = getDb();
  const resourceIds = data.sources.map((source) => source.resourceId);
  if (new Set(resourceIds).size !== resourceIds.length || new Set(data.sources.map((source) => source.citationKey)).size !== data.sources.length) throw new Error("The RRL source snapshot contains duplicate sources or citation keys.");
  const linkKeys = new Set(data.citationLinks.map((link) => link.citationKey));
  if ([...linkKeys].some((key) => !data.sources.some((source) => source.citationKey === key))) throw new Error("RRL citation links must map to the source snapshot.");
  return db.transaction(async (tx) => {
    const [study] = await tx.select().from(studies).where(and(eq(studies.id, data.studyId), eq(studies.userId, profile.id))).for("update").limit(1);
    requireOwnedRecord(study, profile.id);
    const [existing] = await tx.select().from(rrlDrafts).where(and(eq(rrlDrafts.studyId, data.studyId), eq(rrlDrafts.generationRequestId, data.generationRequestId))).limit(1);
    if (existing) return existing;
    const selected = await tx.select({ resourceId: studyRelatedSources.resourceId }).from(studyRelatedSources).where(and(eq(studyRelatedSources.studyId, data.studyId), eq(studyRelatedSources.selectedForRrl, true), inArray(studyRelatedSources.resourceId, resourceIds)));
    if (selected.length !== resourceIds.length) throw new Error("One or more RRL sources are no longer selected for this Study.");
    const [versions] = await tx.select({ draft: max(rrlDrafts.draftVersion), generation: max(rrlDrafts.generationVersion) }).from(rrlDrafts).where(eq(rrlDrafts.studyId, data.studyId));
    const [draft] = await tx.insert(rrlDrafts).values({ studyId: data.studyId, citationStyle: data.citationStyle, content: data.content, contentHash: hashForContent(data.content), draftVersion: (versions?.draft ?? 0) + 1, generationVersion: (versions?.generation ?? 0) + 1, model: data.model, modelVersion: data.modelVersion ?? null, generationRequestId: data.generationRequestId, structuredContent: data.structuredContent, integrityContext: data.integrityContext }).returning();
    if (!draft) throw new Error("Could not save the generated RRL.");
    await tx.insert(rrlDraftSources).values(data.sources.map((source) => ({ draftId: draft.id, resourceId: source.resourceId, citationKey: source.citationKey, sourceSnapshot: source.sourceSnapshot, selectedAtGeneration: true })));
    if (data.citationLinks.length) await tx.insert(rrlCitationLinks).values(data.citationLinks.map((link) => ({ draftId: draft.id, ...link })));
    return draft;
  });
}

export async function getRrlDraft(draftId: string) {
  const id = idSchema.parse(draftId), profile = await getCurrentUserProfile(), db = getDb();
  const draft = await findOwnedDraft(id, profile.id);
  const [sources, citationLinks, audits] = await Promise.all([
    db.select({ membership: rrlDraftSources, resource: resources }).from(rrlDraftSources).innerJoin(resources, eq(resources.id, rrlDraftSources.resourceId)).where(eq(rrlDraftSources.draftId, id)),
    db.select({ link: rrlCitationLinks, resource: resources }).from(rrlCitationLinks).innerJoin(resources, eq(resources.id, rrlCitationLinks.resourceId)).where(eq(rrlCitationLinks.draftId, id)),
    db.select().from(rrlAudits).where(eq(rrlAudits.draftId, id)).orderBy(desc(rrlAudits.createdAt)),
  ]);
  return { draft, sources, citationLinks, audits, auditIsCurrent: audits.some((audit) => audit.draftVersion === draft.draftVersion && audit.draftContentHash === draft.contentHash) };
}

export async function updateRrlDraft(draftId: string, input: unknown) {
  const id = idSchema.parse(draftId), patch = z.object({ citationStyle: z.enum(["apa", "mla", "chicago"]).optional(), content: z.string().max(500000).optional() }).refine((v) => Object.keys(v).length > 0).parse(input);
  const profile = await getCurrentUserProfile(), db = getDb();
  const draft = await findOwnedDraft(id, profile.id);
  const content = patch.content ?? draft.content;
  const snapshot = await db.select().from(rrlDraftSources).where(eq(rrlDraftSources.draftId, draft.id));
  const allowed = new Set(snapshot.map((source) => source.citationKey));
  if (extractCitationKeys(content).some((key) => !allowed.has(key))) throw new Error("Edited content contains a citation key outside this draft's immutable source allow-list.");
  return db.transaction(async (tx) => {
    const [versions] = await tx.select({ draft: max(rrlDrafts.draftVersion) }).from(rrlDrafts).where(eq(rrlDrafts.studyId, draft.studyId));
    const [created] = await tx.insert(rrlDrafts).values({ studyId: draft.studyId, citationStyle: patch.citationStyle ?? draft.citationStyle, content, contentHash: hashForContent(content), draftVersion: (versions?.draft ?? draft.draftVersion) + 1, generationVersion: draft.generationVersion, model: draft.model, modelVersion: draft.modelVersion, structuredContent: null, integrityContext: draft.integrityContext }).returning();
    if (!created) return null;
    if (snapshot.length) await tx.insert(rrlDraftSources).values(snapshot.map((source) => ({ draftId: created.id, resourceId: source.resourceId, citationKey: source.citationKey, sourceSnapshot: source.sourceSnapshot, selectedAtGeneration: source.selectedAtGeneration })));
    const links = await tx.select().from(rrlCitationLinks).where(eq(rrlCitationLinks.draftId, draft.id));
    if (links.length) await tx.insert(rrlCitationLinks).values(links.map((link) => ({ draftId: created.id, resourceId: link.resourceId, citationKey: link.citationKey, sectionKey: link.sectionKey, contextSnippet: link.contextSnippet })));
    return created;
  });
}

export async function addRrlCitationLink(draftId: string, input: unknown) {
  const id = idSchema.parse(draftId), data = citationLinkSchema.parse(input), profile = await getCurrentUserProfile(), db = getDb();
  await findOwnedDraft(id, profile.id);
  const [allowedSource] = await db.select({ resourceId: rrlDraftSources.resourceId }).from(rrlDraftSources)
    .where(and(eq(rrlDraftSources.draftId, id), eq(rrlDraftSources.resourceId, data.resourceId), eq(rrlDraftSources.selectedAtGeneration, true))).limit(1);
  if (!allowedSource) return requireOwnedRecord(null, profile.id);
  const [link] = await db.insert(rrlCitationLinks).values({ draftId: id, ...data }).onConflictDoUpdate({
    target: [rrlCitationLinks.draftId, rrlCitationLinks.citationKey], set: { ...data },
  }).returning();
  return link;
}

export async function removeRrlCitationLink(draftId: string, citationKey: string) {
  const id = idSchema.parse(draftId), key = z.string().trim().min(1).max(160).parse(citationKey), profile = await getCurrentUserProfile(), db = getDb();
  await findOwnedDraft(id, profile.id);
  await db.delete(rrlCitationLinks).where(and(eq(rrlCitationLinks.draftId, id), eq(rrlCitationLinks.citationKey, key)));
}

export async function recordRrlAudit(draftId: string, input: unknown) {
  const id = idSchema.parse(draftId), data = auditSchema.parse(input), profile = await getCurrentUserProfile(), db = getDb();
  const draft = await findOwnedDraft(id, profile.id);
  if (data.draftVersion !== draft.draftVersion || data.draftContentHash !== draft.contentHash) return null;
  const [row] = await db.insert(rrlAudits).values({ draftId: id, ...data }).returning();
  return row;
}

export async function deleteRrlDraft(draftId: string) {
  const id = idSchema.parse(draftId), profile = await getCurrentUserProfile(), db = getDb();
  const draft = await findOwnedDraft(id, profile.id);
  await db.delete(rrlDrafts).where(eq(rrlDrafts.id, draft.id));
}

export async function listRrlDraftsForStudy(studyId: string) {
  const id = idSchema.parse(studyId), profile = await getCurrentUserProfile(), db = getDb();
  const [study] = await db.select({ id: studies.id }).from(studies).where(and(eq(studies.id, id), eq(studies.userId, profile.id))).limit(1);
  requireOwnedRecord(study && { ...study, userId: profile.id }, profile.id);
  return db.select().from(rrlDrafts).where(eq(rrlDrafts.studyId, id)).orderBy(desc(rrlDrafts.updatedAt));
}
