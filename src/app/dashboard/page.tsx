import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, BookOpen, FileSearch, LibraryBig, ShieldCheck } from "lucide-react";
import { Brand } from "~/components/brand";
import { HeroParticles } from "~/components/hero-particles";
import { LandingAuthLinks } from "~/components/landing-auth-links";
import { SignedInDashboard } from "~/components/signed-in-dashboard";
import { SiteFooter } from "~/components/site-footer";
import { ThemeControl } from "~/components/theme-control";
import { WorkspaceShell } from "~/components/workspace-shell";

const capabilities = [
  { title: "Discover literature", description: "Search for scholarly articles and books, and review source details.", icon: FileSearch },
  { title: "Organize sources", description: "Save references, group them in collections, and prepare citations.", icon: LibraryBig },
  { title: "Analyze studies", description: "Upload a study to develop a research profile and find related literature.", icon: BookOpen },
  { title: "Check your writing", description: "Review citations and source integrity in your editable literature review.", icon: ShieldCheck },
];

export default async function DashboardPage() {
  const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  const userId = configured ? (await auth()).userId : null;
  if (userId) return <WorkspaceShell><SignedInDashboard /></WorkspaceShell>;

  return <div className="flex min-h-screen flex-col bg-background">
    <a href="#dashboard-main" className="skip-link">Skip to content</a>
    <header className="border-b border-border bg-card/90 px-4 py-3 backdrop-blur sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><Brand /><div className="flex flex-wrap items-center gap-2"><ThemeControl /><LandingAuthLinks /></div></div>
    </header>
    <main id="dashboard-main" className="flex-1">
      <section className="relative isolate overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-cyan-500/10 px-4 py-16 sm:px-6 sm:py-24">
        <HeroParticles />
        <div className="relative mx-auto max-w-7xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Explore HCCite</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">A clearer path from source to research.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">HCCite brings literature discovery, saved references, study analysis, and citation review into one research workspace for Holy Cross College.</p>
          <div className="mt-8 flex flex-wrap gap-3"><Link href="/sign-in" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Sign in <ArrowRight aria-hidden="true" className="size-4" /></Link><Link href="/sign-up" className="inline-flex min-h-11 items-center rounded-xl border border-border bg-card px-5 font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Create an account</Link></div>
          <p className="mt-4 text-sm text-muted-foreground">Sign in to search, save, upload, and work with your research.</p>
        </div>
      </section>
      <section aria-labelledby="features-heading" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        <h2 id="features-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">What you can do in HCCite</h2>
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{capabilities.map(({ title, description, icon: Icon }) => <article key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm"><span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span><h3 className="mt-5 font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p></article>)}</div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
