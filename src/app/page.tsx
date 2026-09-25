import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BookOpen, FileSearch, GraduationCap, Info, LibraryBig, MapPin, ShieldCheck, UserRoundPlus } from "lucide-react";
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
      <header className="sticky top-0 z-30 border-b border-border/80 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <ThemeControl />
            <LandingAuthLinks />
          </div>
        </div>
      </header>

      <main id="main">
        <section className="relative isolate overflow-hidden bg-gradient-to-b from-sky-50/80 via-background to-background px-4 py-12 dark:from-slate-950 dark:via-background sm:px-6 sm:py-16 lg:px-8 lg:py-24">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-40 top-12 size-[30rem] rounded-full bg-primary/10 blur-[110px]" />
            <div className="absolute -right-48 top-1/4 size-[34rem] rounded-full bg-cyan-400/10 blur-[120px]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          </div>
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-14">
            <div className="max-w-2xl">
              <p className="mb-6 inline-flex max-w-full items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-[0.7rem] font-bold uppercase tracking-[0.13em] text-primary shadow-sm shadow-primary/5 sm:text-xs"><GraduationCap aria-hidden="true" className="size-4 shrink-0" />A research workspace for Holy Cross College</p>
              <h1 className="text-4xl font-bold leading-[1.06] tracking-[-0.045em] text-foreground sm:text-6xl lg:text-[4.5rem]">Make every source <span className="text-primary">count.</span></h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground sm:text-xl">HCCite is being built to help researchers discover literature, manage references, analyze studies, and write with a clear trail back to real sources.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/dashboard" prefetch={false} className="group inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Open workspace <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" /></Link>
                <Link href="/sign-up" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-border/90 bg-card/80 px-5 text-sm font-semibold text-foreground shadow-sm transition-colors hover:border-primary/35 hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><UserRoundPlus aria-hidden="true" className="size-4" />Create an account</Link>
              </div>
              <p className="mt-5 flex max-w-xl items-start gap-2 text-sm leading-6 text-muted-foreground"><Info aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary/80" /><span>Sign in to access your workspace. Research tools are being added in later phases.</span></p>
            </div>
            <div className="group relative rounded-[2rem] border border-border/80 bg-card/70 p-2 shadow-2xl shadow-slate-950/10 ring-1 ring-white/10 backdrop-blur-sm dark:shadow-black/30 sm:rounded-[2.25rem] sm:p-3">
              <div className="relative overflow-hidden rounded-[1.5rem] sm:rounded-[1.75rem]">
                <Image src="/assets/hero.png" alt="Holy Cross College campus building in Sta. Ana, Pampanga" width={3800} height={2534} priority sizes="(max-width: 1024px) 100vw, 50vw" className="h-[280px] w-full object-cover transition-transform duration-700 group-hover:scale-[1.025] sm:h-[380px] lg:h-[min(40vw,520px)]" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent px-5 pb-5 pt-20 text-white sm:px-7 sm:pb-7">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur"><MapPin aria-hidden="true" className="size-5" /></span>
                    <span><span className="block text-xs font-semibold uppercase tracking-[0.16em] text-white/75">Rooted in our community</span><span className="mt-1 block text-sm font-semibold sm:text-base">Holy Cross College <span className="font-normal text-white/75">· Sta. Ana, Pampanga</span></span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="features-heading" className="border-t border-border/70 bg-muted/20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Built around your research process</p>
              <h2 id="features-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One place for the research journey</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">These capabilities are on the roadmap. The current build provides the foundation and route preview.</p>
            </div>
            <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {plannedFeatures.map(({ title, description, icon: Icon }, index) => (
                <article key={title} className="group relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 sm:rounded-3xl">
                  <span aria-hidden="true" className="absolute right-5 top-5 font-mono text-xs font-semibold tracking-widest text-muted-foreground/50">0{index + 1}</span>
                  <span className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/10 transition-colors group-hover:bg-primary/15"><Icon aria-hidden="true" className="size-5" /></span>
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
