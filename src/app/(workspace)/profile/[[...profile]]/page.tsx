import type { Metadata } from "next";
import { UserProfile } from "@clerk/nextjs";
import { requireUserId } from "~/server/auth";

export const metadata: Metadata = { title: "My account" };

export default async function ProfilePage() {
  await requireUserId();
  return (
    <section aria-labelledby="profile-heading">
      <h1 id="profile-heading" className="mb-6 text-3xl font-bold tracking-tight">My account</h1>
      <div className="max-w-full overflow-x-auto">
        <UserProfile fallback={<p role="status" className="text-muted-foreground">Loading account…</p>} />
      </div>
    </section>
  );
}
