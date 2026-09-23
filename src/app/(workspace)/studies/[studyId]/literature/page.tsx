import { requireUserId } from "~/server/auth";

export default async function Page() {
  await requireUserId();
  return <section className="mt-7 rounded-2xl border border-border bg-card p-6 sm:p-8"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Planned for phase 08</p><h2 className="mt-2 text-xl font-semibold">Related literature</h2><p className="mt-3 leading-7 text-muted-foreground">Profile-driven source discovery and selection will appear here. This route contains no study data yet.</p></section>;
}
