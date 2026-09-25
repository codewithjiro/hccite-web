import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, FileSearch, GraduationCap, Info, LibraryBig, ShieldCheck, UserRoundPlus } from "lucide-react";
import { Brand } from "~/components/brand";
import { ThemeControl } from "~/components/theme-control";
import { LandingAuthLinks } from "~/components/landing-auth-links";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

const plannedFeatures = [
  { title: "Discover sources", description: "Find scholarly articles and books, then inspect their bibliographic details.", icon: FileSearch },
  { title: "Keep your library", description: "Collect useful references, organize them, and prepare citations.", icon: LibraryBig },
  { title: "Work from your study", description: "Analyze a study and use selected literature to support an editable review.", icon: BookOpen },
  { title: "Check the evidence", description: "Trace citations back to sources and review integrity before export.", icon: ShieldCheck },
];

export default async function HomePage() {
  if (process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    const { userId } = await auth();
    if (userId) redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-background">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <ThemeControl />
            <LandingAuthLinks />
          </div>
        </div>
      </header>

      <main id="main">
        <section className="overflow-hidden bg-gradient-to-b from-sky-50 to-background px-4 py-12 dark:from-slate-950 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.03fr)] lg:gap-14">
            <div className="max-w-2xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.13em] text-primary"><GraduationCap aria-hidden="true" className="size-4 shrink-0" />A research workspace for Holy Cross College</p>
              <h1 className="text-4xl font-bold leading-[1.12] tracking-tight text-foreground sm:text-5xl lg:text-6xl">Make every source <span className="text-primary">count.</span></h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">HCCite is being built to help researchers discover literature, manage references, analyze studies, and write with a clear trail back to real sources.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/dashboard" prefetch={false} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Open workspace <ArrowRight aria-hidden="true" className="size-4" /></Link>
                <Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border bg-card px-5 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><UserRoundPlus aria-hidden="true" className="size-4" />Create an account</Link>
              </div>
              <p className="mt-5 flex items-start gap-2 text-sm text-muted-foreground"><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>Sign in to access your workspace. Research tools are being added in later phases.</span></p>
            </div>
            <div className="rounded-[2rem] border border-border bg-card p-2 shadow-xl shadow-blue-950/10 dark:shadow-black/20 sm:p-3">
              <Image src="/assets/hero.png" alt="Holy Cross College campus building in Sta. Ana, Pampanga" width={3800} height={2534} priority sizes="(max-width: 1024px) 100vw, 50vw" className="h-auto w-full rounded-[1.4rem]" />
            </div>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">What HCCite is planning</p>
              <h2 id="features-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One place for the research journey</h2>
              <p className="mt-4 text-muted-foreground">These capabilities are on the roadmap. The current build provides the foundation and route preview.</p>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {plannedFeatures.map(({ title, description, icon: Icon }) => (
                <article key={title} className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                  <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" className="size-5" /></span>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-7 text-center text-sm text-muted-foreground sm:px-6">HCCite · Holy Cross College research workspace</footer>
    </div>
  );
}
