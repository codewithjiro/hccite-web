import "server-only";

import { currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { requireUserId } from "~/server/auth";

/** Resolve the authenticated Clerk principal to its HCCite-owned profile. */
export async function getCurrentUserProfile() {
  const clerkUserId = await requireUserId();
  const clerkUser = await currentUser();
  const displayName = clerkUser?.id === clerkUserId
    ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() || clerkUser.username || null
    : null;
  const db = getDb();
  const [profile] = await db.insert(userProfiles)
    .values({ clerkUserId, displayName })
    .onConflictDoUpdate({
      target: userProfiles.clerkUserId,
      set: { displayName, updatedAt: new Date() },
    })
    .returning();
  if (!profile) throw new Error("Could not resolve the authenticated HCCite profile.");
  return profile;
}

/** Lookup by Clerk ID is server-only; browser input must never be passed here. */
export async function findProfileForCurrentUser() {
  const clerkUserId = await requireUserId();
  const [profile] = await getDb().select().from(userProfiles).where(eq(userProfiles.clerkUserId, clerkUserId)).limit(1);
  return profile ?? null;
}
