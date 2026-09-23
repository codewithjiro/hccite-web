import "server-only";

import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { isRecordOwner } from "~/lib/ownership";

/** Require a browser session in every private Server Component, Action, or handler. */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth.protect();
  return userId;
}

/**
 * Call after loading a user-owned row. For tables whose userId is an internal
 * UserProfile ID, resolve that profile from the Clerk ID before passing ownerId.
 * A missing or foreign row has the same response to avoid exposing its existence.
 */
export function requireOwnedRecord<T extends { userId: string }>(
  record: T | null | undefined,
  ownerId: string,
): T {
  if (!record || !isRecordOwner(record, ownerId)) notFound();
  return record;
}
