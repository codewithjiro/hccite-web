import Link from "next/link";

const views = [
  { href: "analysis", label: "Analysis" },
  { href: "literature", label: "Related literature" },
  { href: "rrl", label: "RRL draft" },
] as const;

export default async function StudyLayout({ children, params }: { children: React.ReactNode; params: Promise<{ studyId: string }> }) {
  const { studyId } = await params;
  const base = `/studies/${encodeURIComponent(studyId)}`;
  return (
    <div className="mx-auto max-w-4xl py-6 sm:py-10">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">My Studies</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Study workspace</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">Study metadata is visible only to its authenticated owner.</p>
      <nav aria-label="Study views" className="mt-7 flex flex-wrap gap-2">
        {views.map((view) => <Link key={view.href} href={`${base}/${view.href}`} className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-4 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">{view.label}</Link>)}
      </nav>
      {children}
    </div>
  );
}
