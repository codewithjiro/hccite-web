import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireOwnedRecord } from "~/server/auth";
import { getDb } from "~/server/db";
import { collectionResources, collections, resources, resourceTags, savedResources, tags } from "~/server/db/schema";
import { getCurrentUserProfile } from "./profiles";

const idSchema = z.string().uuid();
const collectionInputSchema = z.object({ name: z.string().trim().min(1).max(160), description: z.string().trim().max(20000).nullable().optional() });
const collectionPatchSchema = collectionInputSchema.partial().refine((v) => Object.keys(v).length > 0);
const tagInputSchema = z.object({ name: z.string().trim().min(1).max(80) });

export async function createCollection(input: unknown) {
  const data = collectionInputSchema.parse(input);
  const profile = await getCurrentUserProfile();
  const db = getDb();
  const [row] = await db.insert(collections).values({ ...data, userId: profile.id }).onConflictDoNothing().returning();
  if (row) return row;
  const [existing] = await db.select().from(collections).where(and(eq(collections.userId, profile.id), sql`lower(${collections.name}) = lower(${data.name})`)).limit(1);
  return existing ?? null;
}

export async function listCollections() {
  const profile = await getCurrentUserProfile();
  return getDb().select().from(collections).where(eq(collections.userId, profile.id)).orderBy(desc(collections.updatedAt));
}

export async function getCollection(collectionId: string) {
  const id = idSchema.parse(collectionId);
  const profile = await getCurrentUserProfile();
  const db = getDb();
  const [row] = await db.select().from(collections).where(and(eq(collections.id, id), eq(collections.userId, profile.id))).limit(1);
  const owned = requireOwnedRecord(row, profile.id);
  const items = await db.select({ membership: collectionResources, resource: resources })
    .from(collectionResources).innerJoin(resources, eq(resources.id, collectionResources.resourceId))
    .where(eq(collectionResources.collectionId, owned.id)).orderBy(desc(collectionResources.addedAt));
  return { ...owned, items };
}

export async function updateCollection(collectionId: string, input: unknown) {
  const id = idSchema.parse(collectionId), patch = collectionPatchSchema.parse(input);
  const profile = await getCurrentUserProfile(), db = getDb();
  const [row] = await db.select().from(collections).where(and(eq(collections.id, id), eq(collections.userId, profile.id))).limit(1);
  const owned = requireOwnedRecord(row, profile.id);
  const [updated] = await db.update(collections).set({ ...patch, updatedAt: new Date() }).where(and(eq(collections.id, owned.id), eq(collections.userId, profile.id))).returning();
  return updated ?? null;
}

export async function addResourceToCollection(collectionId: string, resourceId: string) {
  const collectionKey = idSchema.parse(collectionId), resourceKey = idSchema.parse(resourceId);
  const profile = await getCurrentUserProfile(), db = getDb();
  const [owned] = await db.select({ id: collections.id }).from(collections).where(and(eq(collections.id, collectionKey), eq(collections.userId, profile.id))).limit(1);
  requireOwnedRecord(owned && { ...owned, userId: profile.id }, profile.id);
  const [resource] = await db.select({ id: resources.id }).from(resources).where(eq(resources.id, resourceKey)).limit(1);
  if (!resource) return null;
  const [saved] = await db.select({ id: savedResources.id }).from(savedResources).where(and(eq(savedResources.userId, profile.id), eq(savedResources.resourceId, resourceKey))).limit(1);
  if (!saved) return null;
  const [membership] = await db.insert(collectionResources).values({ collectionId: collectionKey, resourceId: resourceKey }).onConflictDoNothing().returning();
  if (membership) return membership;
  const [existing] = await db.select().from(collectionResources).where(and(eq(collectionResources.collectionId, collectionKey), eq(collectionResources.resourceId, resourceKey))).limit(1);
  return existing ?? null;
}

export async function removeResourceFromCollection(collectionId: string, resourceId: string) {
  const collectionKey = idSchema.parse(collectionId), resourceKey = idSchema.parse(resourceId);
  const profile = await getCurrentUserProfile(), db = getDb();
  const [owned] = await db.select({ id: collections.id }).from(collections).where(and(eq(collections.id, collectionKey), eq(collections.userId, profile.id))).limit(1);
  requireOwnedRecord(owned && { ...owned, userId: profile.id }, profile.id);
  await db.delete(collectionResources).where(and(eq(collectionResources.collectionId, collectionKey), eq(collectionResources.resourceId, resourceKey)));
}

export async function deleteCollection(collectionId: string) {
  const id = idSchema.parse(collectionId), profile = await getCurrentUserProfile(), db = getDb();
  const [row] = await db.select().from(collections).where(and(eq(collections.id, id), eq(collections.userId, profile.id))).limit(1);
  const owned = requireOwnedRecord(row, profile.id);
  await db.delete(collections).where(and(eq(collections.id, owned.id), eq(collections.userId, profile.id)));
}

export async function createTag(input: unknown) {
  const { name } = tagInputSchema.parse(input), profile = await getCurrentUserProfile(), db = getDb();
  const [created] = await db.insert(tags).values({ name, userId: profile.id }).onConflictDoNothing().returning();
  if (created) return created;
  const [existing] = await db.select().from(tags).where(and(eq(tags.userId, profile.id), sql`lower(${tags.name}) = lower(${name})`)).limit(1);
  return existing ?? null;
}

export async function attachTag(savedResourceId: string, tagId: string) {
  const savedId = idSchema.parse(savedResourceId), tagKey = idSchema.parse(tagId), profile = await getCurrentUserProfile(), db = getDb();
  const [saved] = await db.select({ id: savedResources.id }).from(savedResources).where(and(eq(savedResources.id, savedId), eq(savedResources.userId, profile.id))).limit(1);
  requireOwnedRecord(saved && { ...saved, userId: profile.id }, profile.id);
  const [tag] = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.id, tagKey), eq(tags.userId, profile.id))).limit(1);
  requireOwnedRecord(tag && { ...tag, userId: profile.id }, profile.id);
  const [link] = await db.insert(resourceTags).values({ savedResourceId: savedId, tagId: tagKey }).onConflictDoNothing().returning();
  return link ?? null;
}

export async function removeTag(savedResourceId: string, tagId: string) {
  const savedId = idSchema.parse(savedResourceId), tagKey = idSchema.parse(tagId), profile = await getCurrentUserProfile(), db = getDb();
  const [saved] = await db.select({ id: savedResources.id }).from(savedResources).where(and(eq(savedResources.id, savedId), eq(savedResources.userId, profile.id))).limit(1);
  requireOwnedRecord(saved && { ...saved, userId: profile.id }, profile.id);
  const [tag] = await db.select({ id: tags.id }).from(tags).where(and(eq(tags.id, tagKey), eq(tags.userId, profile.id))).limit(1);
  requireOwnedRecord(tag && { ...tag, userId: profile.id }, profile.id);
  await db.delete(resourceTags).where(and(eq(resourceTags.savedResourceId, savedId), eq(resourceTags.tagId, tagKey)));
}

export async function listTags() {
  const profile = await getCurrentUserProfile();
  return getDb().select().from(tags).where(eq(tags.userId, profile.id)).orderBy(tags.name);
}

export async function deleteTag(tagId: string) {
  const id = idSchema.parse(tagId), profile = await getCurrentUserProfile();
  const [deleted] = await getDb().delete(tags).where(and(eq(tags.id, id), eq(tags.userId, profile.id))).returning({ id: tags.id });
  return !!deleted;
}

export async function listLibraryLinks() {
  const profile = await getCurrentUserProfile(), db = getDb();
  const [tagLinks, collectionLinks] = await Promise.all([
    db.select({ savedResourceId: resourceTags.savedResourceId, tagId: resourceTags.tagId }).from(resourceTags)
      .innerJoin(savedResources, eq(savedResources.id, resourceTags.savedResourceId))
      .where(eq(savedResources.userId, profile.id)),
    db.select({ resourceId: collectionResources.resourceId, collectionId: collectionResources.collectionId }).from(collectionResources)
      .innerJoin(collections, eq(collections.id, collectionResources.collectionId))
      .where(eq(collections.userId, profile.id)),
  ]);
  return { tagLinks, collectionLinks };
}
