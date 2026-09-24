import "server-only";

import { and, eq, desc, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOwnedRecord } from "~/server/auth";
import { getDb } from "~/server/db";
import { collectionResources, collections, resources, savedResources } from "~/server/db/schema";
import { getCurrentUserProfile } from "./profiles";
import { conservativeTitleCandidates, isbn10FromIsbn13, isbn13FromIsbn10, mergeNormalizedResources, normalizeDoi, normalizeIsbn, normalizedResourceSchema, type NormalizedResource } from "~/server/discovery/normalization";

const doiSchema = z.string().trim().min(1).max(512).transform(normalizeDoi).refine((doi) => doi !== null, "Enter a valid DOI.").transform((doi) => doi!);
const isbnSchema = z.string().trim().min(1).max(32).transform(normalizeIsbn).refine((isbn) => isbn !== null, "Enter a valid ISBN-10 or ISBN-13.").transform((isbn) => isbn!);
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
export const savedResourceUpdateSchema = z.object({ readingStatus: z.enum(["unread", "reading", "read"]).optional(), notes: z.string().trim().max(10000).nullable().optional() }).strict().refine((v) => Object.keys(v).length > 0);

/** Public normalized metadata may be shared across users. */
export async function createResource(input: unknown) {
  const data = resourceInputSchema.parse(input);
  const [resource] = await getDb().insert(resources).values(data).returning();
  return resource;
}

function asNormalized(resource: typeof resources.$inferSelect): NormalizedResource {
  return normalizedResourceSchema.parse({ ...resource, retrievedAt: resource.retrievedAt ?? resource.createdAt });
}

function identifiers(resource: NormalizedResource) {
  const extras = resource.citationMetadata.isbnVariants;
  const variants = Array.isArray(extras) ? extras.map((item) => item && typeof item === "object" && "isbn" in item ? normalizeIsbn(String(item.isbn ?? "")) : null).filter((v): v is string => !!v) : [];
  const normalized = [resource.isbn, ...variants].map((value) => normalizeIsbn(value)).filter((value): value is string => !!value);
  const isbn13 = normalized.find((value) => value.length === 13) ?? normalized.map(isbn13FromIsbn10).find((value) => !!value) ?? null;
  const isbn10 = normalized.find((value) => value.length === 10) ?? normalized.map(isbn10FromIsbn13).find((value) => !!value) ?? null;
  return { doi: normalizeDoi(resource.doi), isbn13, isbn10 };
}

/** Canonical public Resource resolver used by discovery saves. Matching is exact by DOI/ISBN/provider ID;
 * title matching requires the exact normalized title, year and primary author. Ambiguous sets are never merged.
 */
export async function upsertDiscoveryResource(input: unknown) {
  const incoming = normalizedResourceSchema.parse(input);
  const db = getDb();
  const keys = identifiers(incoming);
  return db.transaction(async (tx) => {
  // Equivalent ISBN-10 and ISBN-13 values do not collide in the single-column
  // unique index. Serialize their identity lookup and insert on one canonical key.
  if (incoming.type === "book" && keys.isbn13) {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`hccite:isbn:${keys.isbn13}`}, 0))`);
  }
  const conditions = [];
  const providerId = incoming.sourceIdentifier ? and(eq(resources.source, incoming.source), eq(resources.sourceIdentifier, incoming.sourceIdentifier)) : null;
  const addDoi = () => { if (keys.doi) conditions.push(sql`lower(regexp_replace(regexp_replace(${resources.doi}, '^doi:\\s*', '', 'i'), '^https?://(dx\\.)?doi\\.org/', '', 'i')) = ${keys.doi}`); };
  const addIsbn = () => {
    if (keys.isbn13) conditions.push(sql`upper(regexp_replace(${resources.isbn}, '[^0-9Xx]', '', 'g')) = ${keys.isbn13}`);
    if (keys.isbn10) conditions.push(sql`upper(regexp_replace(${resources.isbn}, '[^0-9Xx]', '', 'g')) = ${keys.isbn10}`);
  };
  if (incoming.type === "book") {
    addIsbn(); if (providerId) conditions.push(providerId);
  } else {
    addDoi(); if (!keys.doi && providerId) conditions.push(providerId);
    if (incoming.type === "other") addIsbn();
  }
  let existing: typeof resources.$inferSelect | undefined;
  for (const condition of conditions) {
    const [found] = await tx.select().from(resources).where(condition).limit(1);
    if (found) { existing = found; break; }
  }

  let ambiguous: Array<typeof resources.$inferSelect> = [];
  if (!existing && incoming.year && incoming.authors[0]) {
    const candidates = await tx.select().from(resources).where(and(eq(resources.type, incoming.type), eq(resources.year, incoming.year))).limit(5000);
    const matched = conservativeTitleCandidates(incoming, candidates);
    existing = matched.match ?? undefined;
    ambiguous = matched.ambiguous;
  }

  if (existing) {
    const merged = mergeNormalizedResources(asNormalized(existing), incoming);
    const [updated] = await tx.update(resources).set({ ...merged, updatedAt: new Date() }).where(eq(resources.id, existing.id)).returning();
    return { resource: updated ?? existing, reused: true, ambiguous: false };
  }

  // Avoid a nested savepoint merely to handle a uniqueness race. In the postgres-js
  // test client, concurrent nested transactions can leave the reserved connection
  // unusable even after PostgreSQL has committed. A conflict-free insert result gives
  // the same race signal without aborting or nesting the outer transaction.
  const [created] = await tx.insert(resources).values(incoming).onConflictDoNothing().returning();
  if (created) return { resource: created, reused: false, ambiguous: ambiguous.length > 0 };

  // A simultaneous request won a DOI/ISBN/provider-ID unique index after our lookup.
  const [raced] = conditions.length ? await tx.select().from(resources).where(or(...conditions)).limit(1) : [];
  if (!raced) throw new Error("A canonical resource insert conflicted without a matching identifier.");
  const merged = mergeNormalizedResources(asNormalized(raced), incoming);
  const [updated] = await tx.update(resources).set({ ...merged, updatedAt: new Date() }).where(eq(resources.id, raced.id)).returning();
  return { resource: updated ?? raced, reused: true, ambiguous: false };
  });
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
  await db.transaction(async (tx) => {
    const ownCollections = tx.select({ id: collections.id }).from(collections).where(eq(collections.userId, profile.id));
    await tx.delete(collectionResources).where(and(eq(collectionResources.resourceId, owned.resourceId), inArray(collectionResources.collectionId, ownCollections)));
    await tx.delete(savedResources).where(and(eq(savedResources.id, owned.id), eq(savedResources.userId, profile.id)));
  });
}
