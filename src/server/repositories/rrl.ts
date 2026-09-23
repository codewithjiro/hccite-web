import "server-only";

import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOwnedRecord } from "~/server/auth";
import { getDb } from "~/server/db";
import { resources, rrlAudits, rrlCitationLinks, rrlDraftSources, rrlDrafts, studies, studyRelatedSources } from "~/server/db/schema";
import { getCurrentUserProfile } from "./profiles";

const idSchema = z.string().uuid();
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/i);
const hashForContent = (content: string) => createHash("sha256").update(content, "utf8").digest("hex");
export const createDraftSchema = z.object({
  studyId: idSchema, citationStyle: z.enum(["apa", "mla", "chicago"]), content: z.string().max(500000),
  draftVersion: z.number().int().positive().default(1), model: z.string().max(160).nullable().optional(),
  generationVersion: z.number().int().positive().default(1), selectedResourceIds: z.array(idSchema).max(1000).default([]),
});
export const citationLinkSchema = z.object({ citationKey: z.string().trim().min(1).max(160), resourceId: idSchema, sectionKey: z.string().max(160).nullable().optional(), contextSnippet: z.string().max(10000).nullable().optional() });
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
    if (uniqueResourceIds.length) await tx.insert(rrlDraftSources).values(uniqueResourceIds.map((resourceId) => ({ draftId: draft!.id, resourceId, selectedAtGeneration: true })));
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
  const changedDraft = patch.content !== undefined || patch.citationStyle !== undefined;
  const [updated] = await db.update(rrlDrafts).set({ ...patch, ...(patch.content !== undefined ? { contentHash: hashForContent(patch.content) } : {}), draftVersion: changedDraft ? draft.draftVersion + 1 : draft.draftVersion, updatedAt: new Date() }).where(eq(rrlDrafts.id, draft.id)).returning();
  return updated ?? null;
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
