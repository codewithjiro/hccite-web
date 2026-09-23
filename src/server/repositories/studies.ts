import "server-only";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { requireOwnedRecord } from "~/server/auth";
import { getDb } from "~/server/db";
import { resources, studies, studyAnalyses, studyRelatedSources, studySections } from "~/server/db/schema";
import { getCurrentUserProfile } from "./profiles";

const idSchema = z.string().uuid();
export const createStudySchema = z.object({
  title: z.string().trim().min(1).max(500), originalFileName: z.string().trim().min(1).max(512),
  fileType: z.enum(["pdf", "docx"]), fileUrl: z.string().url().max(10000), fileStorageKey: z.string().trim().min(1).max(512),
  pageCount: z.number().int().positive().nullable().optional(),
});
export const studyAnalysisSchema = z.object({
  summary: z.string().trim().min(1).max(100000), researchProblem: z.string().max(50000).nullable().optional(),
  objectives: z.array(z.string().max(10000)).default([]), keywords: z.array(z.string().max(1000)).default([]),
  methodology: z.string().max(50000).nullable().optional(), variablesOrConcepts: z.array(z.string().max(10000)).default([]),
  populationOrSample: z.string().max(50000).nullable().optional(), majorFindings: z.array(z.string().max(10000)).default([]),
  conclusion: z.string().max(50000).nullable().optional(), suggestedQueries: z.array(z.string().max(1000)).default([]),
  importantPageRanges: z.array(z.object({ label: z.string().min(1).max(160), startPage: z.number().int().positive(), endPage: z.number().int().positive() }).refine((r) => r.endPage >= r.startPage)).default([]),
  model: z.string().max(160).nullable().optional(), analysisVersion: z.number().int().positive().default(1),
});
export const studySectionSchema = z.object({ label: z.string().trim().min(1).max(160), startPage: z.number().int().positive(), endPage: z.number().int().positive(), normalizedTextReference: z.string().max(10000).nullable().optional() }).refine((s) => s.endPage >= s.startPage);

export async function createStudy(input: unknown) {
  const data = createStudySchema.parse(input), profile = await getCurrentUserProfile();
  const [row] = await getDb().insert(studies).values({ ...data, userId: profile.id }).returning();
  return row;
}

export async function listStudies() {
  const profile = await getCurrentUserProfile();
  return getDb().select().from(studies).where(eq(studies.userId, profile.id)).orderBy(desc(studies.updatedAt));
}

export async function getStudy(studyId: string) {
  const id = idSchema.parse(studyId), profile = await getCurrentUserProfile();
  const [row] = await getDb().select().from(studies).where(and(eq(studies.id, id), eq(studies.userId, profile.id))).limit(1);
  return requireOwnedRecord(row, profile.id);
}

export async function updateStudyStatus(studyId: string, status: "uploaded" | "processing" | "ready" | "failed", processingError: string | null = null) {
  const id = idSchema.parse(studyId), profile = await getCurrentUserProfile(), db = getDb();
  const [row] = await db.select().from(studies).where(and(eq(studies.id, id), eq(studies.userId, profile.id))).limit(1);
  const owned = requireOwnedRecord(row, profile.id);
  const [updated] = await db.update(studies).set({ status, processingError, updatedAt: new Date() }).where(and(eq(studies.id, owned.id), eq(studies.userId, profile.id))).returning();
  return updated ?? null;
}

/** External file deletion is explicit because PostgreSQL cascades cannot remove stored objects. */
export async function deleteStudy(studyId: string, deleteStoredFile: (storageKey: string) => Promise<void>) {
  const id = idSchema.parse(studyId), profile = await getCurrentUserProfile(), db = getDb();
  const [row] = await db.select().from(studies).where(and(eq(studies.id, id), eq(studies.userId, profile.id))).limit(1);
  const owned = requireOwnedRecord(row, profile.id);
  await deleteStoredFile(owned.fileStorageKey);
  await db.delete(studies).where(and(eq(studies.id, owned.id), eq(studies.userId, profile.id)));
  return owned;
}

export async function getStudyAnalysis(studyId: string) {
  const studyKey = idSchema.parse(studyId), profile = await getCurrentUserProfile(), db = getDb();
  const [owned] = await db.select({ id: studies.id }).from(studies).where(and(eq(studies.id, studyKey), eq(studies.userId, profile.id))).limit(1);
  requireOwnedRecord(owned && { ...owned, userId: profile.id }, profile.id);
  return db.select().from(studyAnalyses).where(eq(studyAnalyses.studyId, studyKey)).orderBy(desc(studyAnalyses.analysisVersion));
}

export async function saveStudyAnalysis(studyId: string, input: unknown) {
  const studyKey = idSchema.parse(studyId), data = studyAnalysisSchema.parse(input), profile = await getCurrentUserProfile(), db = getDb();
  const [owned] = await db.select({ id: studies.id }).from(studies).where(and(eq(studies.id, studyKey), eq(studies.userId, profile.id))).limit(1);
  requireOwnedRecord(owned && { ...owned, userId: profile.id }, profile.id);
  const [row] = await db.insert(studyAnalyses).values({ ...data, studyId: studyKey }).onConflictDoUpdate({
    target: [studyAnalyses.studyId, studyAnalyses.analysisVersion], set: { ...data, updatedAt: new Date() },
  }).returning();
  return row;
}

export async function replaceStudySections(studyId: string, input: unknown[]) {
  const studyKey = idSchema.parse(studyId), sections = z.array(studySectionSchema).parse(input), profile = await getCurrentUserProfile(), db = getDb();
  const [owned] = await db.select({ id: studies.id }).from(studies).where(and(eq(studies.id, studyKey), eq(studies.userId, profile.id))).limit(1);
  requireOwnedRecord(owned && { ...owned, userId: profile.id }, profile.id);
  return db.transaction(async (tx) => {
    await tx.delete(studySections).where(eq(studySections.studyId, studyKey));
    if (!sections.length) return [];
    return tx.insert(studySections).values(sections.map((section) => ({ ...section, studyId: studyKey }))).returning();
  });
}

export async function listStudyRelatedSources(studyId: string) {
  const studyKey = idSchema.parse(studyId), profile = await getCurrentUserProfile(), db = getDb();
  const [owned] = await db.select({ id: studies.id }).from(studies).where(and(eq(studies.id, studyKey), eq(studies.userId, profile.id))).limit(1);
  requireOwnedRecord(owned && { ...owned, userId: profile.id }, profile.id);
  return db.select({ related: studyRelatedSources, resource: resources }).from(studyRelatedSources)
    .innerJoin(resources, eq(resources.id, studyRelatedSources.resourceId)).where(eq(studyRelatedSources.studyId, studyKey));
}

export async function addStudyRelatedSource(studyId: string, input: unknown) {
  const studyKey = idSchema.parse(studyId);
  const data = z.object({ resourceId: idSchema, relevanceReason: z.string().max(20000).nullable().optional(), relevanceScore: z.number().min(0).max(1).nullable().optional(), selectedForRrl: z.boolean().default(false) }).parse(input);
  const profile = await getCurrentUserProfile(), db = getDb();
  const [owned] = await db.select({ id: studies.id }).from(studies).where(and(eq(studies.id, studyKey), eq(studies.userId, profile.id))).limit(1);
  requireOwnedRecord(owned && { ...owned, userId: profile.id }, profile.id);
  const [resource] = await db.select({ id: resources.id }).from(resources).where(eq(resources.id, data.resourceId)).limit(1);
  if (!resource) return null;
  const [row] = await db.insert(studyRelatedSources).values({ ...data, studyId: studyKey }).onConflictDoUpdate({
    target: [studyRelatedSources.studyId, studyRelatedSources.resourceId], set: { relevanceReason: data.relevanceReason, relevanceScore: data.relevanceScore, selectedForRrl: data.selectedForRrl, updatedAt: new Date() },
  }).returning();
  return row ?? null;
}

export async function setStudyRelatedSourceSelection(studyId: string, resourceId: string, selectedForRrl: boolean) {
  const studyKey = idSchema.parse(studyId), resourceKey = idSchema.parse(resourceId), selected = z.boolean().parse(selectedForRrl), profile = await getCurrentUserProfile(), db = getDb();
  const [owned] = await db.select({ id: studies.id }).from(studies).where(and(eq(studies.id, studyKey), eq(studies.userId, profile.id))).limit(1);
  requireOwnedRecord(owned && { ...owned, userId: profile.id }, profile.id);
  const [row] = await db.update(studyRelatedSources).set({ selectedForRrl: selected, updatedAt: new Date() })
    .where(and(eq(studyRelatedSources.studyId, studyKey), eq(studyRelatedSources.resourceId, resourceKey))).returning();
  return row ?? null;
}
