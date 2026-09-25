import "server-only";

import { count, desc, eq } from "drizzle-orm";
import { getDb } from "~/server/db";
import {
  collections,
  resources,
  rrlCitationLinks,
  rrlDrafts,
  savedResources,
  studies,
} from "~/server/db/schema";
import { getCurrentUserProfile } from "./profiles";

type DashboardMetric = "studies" | "savedSources" | "collections" | "citationsGenerated";
type DashboardSection = DashboardMetric | "recentStudies" | "recentSavedResources";

export type DashboardData = {
  counts: Record<DashboardMetric, number | null>;
  recentStudies: Array<typeof studies.$inferSelect>;
  recentSavedResources: Array<{
    saved: typeof savedResources.$inferSelect;
    resource: typeof resources.$inferSelect;
  }>;
  unavailable: DashboardSection[];
};

/**
 * Dashboard definitions:
 * - studies: owned Study rows
 * - savedSources: owned SavedResource rows
 * - collections: owned Collection rows
 * - citationsGenerated: persisted RRL citation occurrences linked to drafts of owned Studies
 *
 * Every query derives the owner from the authenticated server-side profile. Query
 * failures are isolated so one unavailable panel cannot fabricate zeroes or crash
 * the rest of the dashboard.
 */
export async function getDashboardData(): Promise<DashboardData> {
  const profile = await getCurrentUserProfile();
  const db = getDb();
  const queries = {
    studies: db.select({ value: count() }).from(studies).where(eq(studies.userId, profile.id)),
    savedSources: db.select({ value: count() }).from(savedResources).where(eq(savedResources.userId, profile.id)),
    collections: db.select({ value: count() }).from(collections).where(eq(collections.userId, profile.id)),
    citationsGenerated: db.select({ value: count() }).from(rrlCitationLinks)
      .innerJoin(rrlDrafts, eq(rrlDrafts.id, rrlCitationLinks.draftId))
      .innerJoin(studies, eq(studies.id, rrlDrafts.studyId))
      .where(eq(studies.userId, profile.id)),
    recentStudies: db.select().from(studies).where(eq(studies.userId, profile.id))
      .orderBy(desc(studies.updatedAt)).limit(5),
    recentSavedResources: db.select({ saved: savedResources, resource: resources }).from(savedResources)
      .innerJoin(resources, eq(resources.id, savedResources.resourceId))
      .where(eq(savedResources.userId, profile.id)).orderBy(desc(savedResources.updatedAt)).limit(5),
  };
  const keys = Object.keys(queries) as DashboardSection[];
  const settled = await Promise.allSettled(keys.map((key) => queries[key]));
  const results = new Map(keys.map((key, index) => [key, settled[index]!]));
  const unavailable = keys.filter((key) => results.get(key)?.status === "rejected");
  const metric = (key: DashboardMetric) => {
    const result = results.get(key);
    return result?.status === "fulfilled" ? (result.value as Array<{ value: number }>)[0]?.value ?? 0 : null;
  };
  const recentStudyResult = results.get("recentStudies");
  const recentResourceResult = results.get("recentSavedResources");
  return {
    counts: {
      studies: metric("studies"),
      savedSources: metric("savedSources"),
      collections: metric("collections"),
      citationsGenerated: metric("citationsGenerated"),
    },
    recentStudies: recentStudyResult?.status === "fulfilled"
      ? recentStudyResult.value as DashboardData["recentStudies"]
      : [],
    recentSavedResources: recentResourceResult?.status === "fulfilled"
      ? recentResourceResult.value as DashboardData["recentSavedResources"]
      : [],
    unavailable,
  };
}
