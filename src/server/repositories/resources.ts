import "server-only";

import { and, eq, desc } from "drizzle-orm";
import { z } from "zod";
import { requireOwnedRecord } from "~/server/auth";
import { getDb } from "~/server/db";
import { resources, savedResources } from "~/server/db/schema";
import { getCurrentUserProfile } from "./profiles";

const doiSchema = z.string().trim().min(1).max(512).transform((doi) => doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "").toLowerCase());
const isbnSchema = z.string().trim().min(1).max(20).transform((isbn) => isbn.replace(/[^0-9Xx]/g, "").toUpperCase()).refine((isbn) => isbn.length > 0, "ISBN must include a digit or X");
export const resourceInputSchema = z.object({
  type: z.enum(["article", "book", "other"]), title: z.string().trim().min(1).max(10000),
  authors: z.array(z.string().trim().min(1).max(500)).max(500).default([]),
  year: z.number().int().min(1000).max(3000).nullable().optional(), publicationDate: z.string().max(32).nullable().optional(),
  doi: doiSchema.nullable().optional(), isbn: isbnSchema.nullable().optional(),
  publisher: z.string().max(10000).nullable().optional(), venue: z.string().max(10000).nullable().optional(),
  source: z.enum(["openalex", "crossref", "google_books", "manual"]),
  sourceIdentifier: z.string().trim().min(1).max(512).nullable().optional(), url: z.string().url().max(10000).nullable().optional(),
  abstract: z.string().max(100000).nullable().optional(), retrievedAt: z.coerce.date().nullable().optional(),
  citationMetadata: z.record(z.string(), z.unknown()).default({}),
});
export const saveResourceInputSchema = z.object({ resourceId: z.string().uuid() });
export const savedResourceUpdateSchema = z.object({ readingStatus: z.enum(["unread", "reading", "read"]).optional(), notes: z.string().max(50000).nullable().optional() }).refine((v) => Object.keys(v).length > 0);

/** Public normalized metadata may be shared across users. */
export async function createResource(input: unknown) {
  const data = resourceInputSchema.parse(input);
  const [resource] = await getDb().insert(resources).values(data).returning();
  return resource;
}

export async function getResource(resourceId: string) {
  const id = z.string().uuid().parse(resourceId);
  const [resource] = await getDb().select().from(resources).where(eq(resources.id, id)).limit(1);
  return resource ?? null;
}

export async function saveResource(input: unknown) {
  const { resourceId } = saveResourceInputSchema.parse(input);
  const profile = await getCurrentUserProfile();
  const db = getDb();
  const [resource] = await db.select({ id: resources.id }).from(resources).where(eq(resources.id, resourceId)).limit(1);
  if (!resource) return null;
  const [saved] = await db.insert(savedResources).values({ userId: profile.id, resourceId }).onConflictDoNothing({ target: [savedResources.userId, savedResources.resourceId] }).returning();
  if (saved) return saved;
  const [existing] = await db.select().from(savedResources).where(and(eq(savedResources.userId, profile.id), eq(savedResources.resourceId, resourceId))).limit(1);
  return existing ?? null;
}

export async function listSavedResources() {
  const profile = await getCurrentUserProfile();
  return getDb().select({ saved: savedResources, resource: resources }).from(savedResources)
    .innerJoin(resources, eq(resources.id, savedResources.resourceId))
    .where(eq(savedResources.userId, profile.id)).orderBy(desc(savedResources.createdAt));
}

export async function updateSavedResource(savedResourceId: string, input: unknown) {
  const id = z.string().uuid().parse(savedResourceId);
  const patch = savedResourceUpdateSchema.parse(input);
  const profile = await getCurrentUserProfile();
  const db = getDb();
  const [row] = await db.select().from(savedResources).where(and(eq(savedResources.id, id), eq(savedResources.userId, profile.id))).limit(1);
  const owned = requireOwnedRecord(row, profile.id);
  const [updated] = await db.update(savedResources).set({ ...patch, updatedAt: new Date() }).where(and(eq(savedResources.id, owned.id), eq(savedResources.userId, profile.id))).returning();
  return updated ?? null;
}

export async function removeSavedResource(savedResourceId: string) {
  const id = z.string().uuid().parse(savedResourceId);
  const profile = await getCurrentUserProfile();
  const db = getDb();
  const [row] = await db.select().from(savedResources).where(and(eq(savedResources.id, id), eq(savedResources.userId, profile.id))).limit(1);
  const owned = requireOwnedRecord(row, profile.id);
  await db.delete(savedResources).where(and(eq(savedResources.id, owned.id), eq(savedResources.userId, profile.id)));
}
