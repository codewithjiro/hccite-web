import Link from "next/link";
import { formatPhilippineDate } from "~/lib/dates";
import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Files,
  FileSearch,
  FolderOpen,
  LibraryBig,
  Quote,
  SearchCheck,
  Upload,
} from "lucide-react";
import { getDashboardData } from "~/server/repositories/dashboard";
import { HeroParticles } from "~/components/hero-particles";

export async function SignedInDashboard() {
  const dashboard = await getDashboardData();
  const metrics = [
    { label: "My Studies", value: dashboard.counts.studies, icon: Files, href: "/studies" },
    { label: "Saved Sources", value: dashboard.counts.savedSources, icon: LibraryBig, href: "/collections" },
    { label: "Collections", value: dashboard.counts.collections, icon: FolderOpen, href: "/collections" },
    { label: "Citations Generated", value: dashboard.counts.citationsGenerated, icon: Quote, href: "/studies" },
  ];
  const actions = [
    { label: "Search articles", description: "Find scholarly works with OpenAlex", href: "/research-articles", icon: FileSearch },
    { label: "Look up a DOI", description: "Verify metadata with Crossref", href: "/doi-lookup", icon: SearchCheck },
    { label: "Search books", description: "Discover books with Google Books", href: "/books", icon: BookOpen },
    { label: "Upload a study", description: "Add a non-confidential PDF or DOCX", href: "/studies", icon: Upload },
  ];

  return <div className="mx-auto max-w-6xl py-2 sm:py-6">
    <div className="relative isolate overflow-hidden rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-card to-cyan-500/10 p-6 sm:p-8">
      <HeroParticles />
      <div className="relative">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Research workspace</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Dashboard</h1>
      <p className="mt-3 max-w-2xl leading-7 text-muted-foreground">Your current studies, saved research, collections, and traceable RRL citation activity.</p>
      </div>
    </div>

    {dashboard.unavailable.length > 0 && <div role="status" className="mt-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
      Some dashboard data is temporarily unavailable. Available records are still shown; refresh to retry.
    </div>}

    <section aria-labelledby="dashboard-metrics" className="mt-8">
      <h2 id="dashboard-metrics" className="sr-only">Workspace totals</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, icon: Icon, href }) => <Link key={label} href={href} className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          <div className="flex items-start justify-between gap-4"><span className="rounded-xl bg-primary/10 p-2.5 text-primary"><Icon aria-hidden="true" className="size-5" /></span><ArrowRight aria-hidden="true" className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
          <p className="mt-5 text-3xl font-bold tabular-nums">{value ?? "—"}</p>
          <p className="mt-1 text-sm font-medium text-muted-foreground">{label}</p>
          {value === null && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Temporarily unavailable</p>}
        </Link>)}
      </div>
    </section>

    <section aria-labelledby="quick-actions" className="mt-10">
      <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">Start here</p><h2 id="quick-actions" className="mt-1 text-xl font-semibold">Quick actions</h2></div></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map(({ label, description, href, icon: Icon }) => <Link key={href} href={href} className="rounded-2xl border border-border bg-card p-4 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"><Icon aria-hidden="true" className="size-5 text-primary" /><h3 className="mt-3 font-semibold">{label}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></Link>)}
      </div>
    </section>

    <div className="mt-10 grid gap-6 lg:grid-cols-2">
      <section aria-labelledby="recent-studies" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4"><h2 id="recent-studies" className="text-xl font-semibold">Recent studies</h2><Link href="/studies" className="text-sm font-semibold text-primary hover:underline">Open My Studies</Link></div>
        {dashboard.unavailable.includes("recentStudies") ? <Unavailable /> : dashboard.recentStudies.length === 0 ? <Empty icon={Files} title="No studies yet" text="Upload a PDF or DOCX to begin. Check the file privacy notice before uploading." href="/studies" action="Upload a study" /> : <ul className="mt-4 divide-y divide-border">{dashboard.recentStudies.map((study) => <li key={study.id}><Link href={`/studies/${study.id}`} className="flex min-w-0 items-center gap-3 py-4 hover:text-primary"><span className="rounded-lg bg-muted p-2"><Files aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{study.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{study.fileType.toUpperCase()} · <span className="capitalize">{study.status}</span> · Updated {formatPhilippineDate(study.updatedAt)}</span></span><ArrowRight aria-hidden="true" className="size-4 shrink-0" /></Link></li>)}</ul>}
      </section>

      <section aria-labelledby="recent-sources" className="min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-4"><h2 id="recent-sources" className="text-xl font-semibold">Recent saved sources</h2><Link href="/collections" className="text-sm font-semibold text-primary hover:underline">Open library</Link></div>
        {dashboard.unavailable.includes("recentSavedResources") ? <Unavailable /> : dashboard.recentSavedResources.length === 0 ? <Empty icon={BookOpenCheck} title="No saved sources yet" text="Search an academic provider and save a useful source." href="/research-articles" action="Search articles" /> : <ul className="mt-4 divide-y divide-border">{dashboard.recentSavedResources.map(({ saved, resource }) => <li key={saved.id} className="flex min-w-0 items-center gap-3 py-4"><span className="rounded-lg bg-muted p-2"><BookOpen aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-medium">{resource.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{resource.authors.join(", ") || "Author unavailable"} · {resource.year ?? "Year unavailable"} · Saved {formatPhilippineDate(saved.createdAt)}</span></span></li>)}</ul>}
      </section>
    </div>
  </div>;
}

function Unavailable() {
  return <p className="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">This activity list is temporarily unavailable. Refresh to retry.</p>;
}

function Empty({ icon: Icon, title, text, href, action }: { icon: typeof Files; title: string; text: string; href: string; action: string }) {
  return <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center"><Icon aria-hidden="true" className="mx-auto size-7 text-muted-foreground" /><h3 className="mt-3 font-semibold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p><Link href={href} className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90">{action}</Link></div>;
}
