import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, FileSearch, GraduationCap, Image as ImageIcon, Info, LibraryBig, Mail, MapPin, ShieldCheck, UserRound, UserRoundPlus } from "lucide-react";
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

const developers = [
  { name: "Jenah Ambagan", initials: "JA", tone: "from-sky-400/25 via-blue-500/15 to-indigo-500/20" },
  { name: "Venice Bumagat", initials: "VB", tone: "from-violet-400/25 via-fuchsia-500/15 to-pink-500/20" },
  { name: "Jiro Gonzales", initials: "JG", tone: "from-cyan-400/25 via-teal-500/15 to-emerald-500/20" },
  { name: "Nicole Manaloto", initials: "NM", tone: "from-amber-400/25 via-orange-500/15 to-rose-500/20" },
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
          <nav aria-label="Main navigation" className="order-3 flex w-full items-center justify-center gap-1 border-t border-border/70 pt-2 md:order-none md:ml-auto md:w-auto md:border-0 md:pt-0">
            {[["About", "#about"], ["Developers", "#developers"], ["Contact", "#contact"]].map(([label, href]) => <Link key={href} href={href} className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">{label}</Link>)}
          </nav>
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

        <section id="about" aria-labelledby="about-heading" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-16">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><span className="h-px w-6 bg-primary" />About HCCite</p>
              <h2 id="about-heading" className="mt-4 max-w-xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">Research is stronger when every source has a clear path.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">HCCite is being developed as a research workspace for Holy Cross College. Its goal is to bring source discovery, reference organization, citation tools, and study analysis together while keeping research connected to its sources.</p>
            </div>
            <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-6 shadow-lg shadow-slate-950/[0.04] sm:p-8">
              <div aria-hidden="true" className="absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">A thoughtful research process</p>
                <ul className="mt-6 space-y-5">
                  <li className="flex gap-4"><span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSearch aria-hidden="true" className="size-5" /></span><span><span className="block font-semibold">Find relevant sources</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">Discover scholarly articles and books for your work.</span></span></li>
                  <li className="flex gap-4"><span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><LibraryBig aria-hidden="true" className="size-5" /></span><span><span className="block font-semibold">Keep references organized</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">Collect useful sources and prepare citations in one place.</span></span></li>
                  <li className="flex gap-4"><span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck aria-hidden="true" className="size-5" /></span><span><span className="block font-semibold">Stay close to the evidence</span><span className="mt-1 block text-sm leading-6 text-muted-foreground">Keep a clear trail from research writing back to real sources.</span></span></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id="developers" aria-labelledby="developers-heading" className="scroll-mt-24 border-y border-border/70 bg-muted/20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">The people behind HCCite</p>
              <h2 id="developers-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Meet the developers</h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">The team behind the project, building a research workspace for the Holy Cross College community. Portraits are placeholders for now.</p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {developers.map((developer) => (
                <article key={developer.name} className="group overflow-hidden rounded-3xl border border-border/80 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                  <div role="img" aria-label={`Photo placeholder for ${developer.name}`} className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-gradient-to-br ${developer.tone}`}>
                    <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.5),transparent_38%)] dark:bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.12),transparent_38%)]" />
                    <div className="relative flex size-28 items-center justify-center rounded-full border border-white/50 bg-white/35 text-primary shadow-lg shadow-slate-950/10 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 dark:border-white/15 dark:bg-slate-950/20">
                      <UserRound aria-hidden="true" className="size-14 stroke-[1.25]" />
                      <span className="absolute -bottom-1 -right-1 inline-flex size-9 items-center justify-center rounded-full border-2 border-card bg-primary text-[10px] font-bold tracking-wide text-primary-foreground">{developer.initials}</span>
                    </div>
                    <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-slate-950/35 px-3 py-1.5 text-[11px] font-medium text-white backdrop-blur"><ImageIcon aria-hidden="true" className="size-3.5" />Photo placeholder</span>
                  </div>
                  <div className="p-5">
                    <h3 className="text-lg font-semibold tracking-tight">{developer.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Developer</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-cyan-500/10 p-7 shadow-lg shadow-primary/5 sm:p-10 lg:p-14">
              <div aria-hidden="true" className="absolute -right-24 -top-28 size-80 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.62fr)] md:gap-12">
                <div>
                  <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"><Mail aria-hidden="true" className="size-4" />Contact</p>
                  <h2 id="contact-heading" className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Have a question or an idea?</h2>
                  <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">Have a question, suggestion, or feedback? Send the HCCite team a message—we’d love to hear from you.</p>
                </div>
                <Link href="mailto:hccite@hcc.edu" className="group flex items-center gap-4 rounded-2xl border border-border/80 bg-card/80 p-5 shadow-sm backdrop-blur transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-lg sm:p-6">
                  <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Mail aria-hidden="true" className="size-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Email the team</span><span className="mt-1 block break-all font-semibold text-foreground">hccite@hcc.edu</span></span>
                  <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/60 px-4 py-7 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>HCCite · Holy Cross College research workspace</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-4">
            <Link href="#about" className="transition-colors hover:text-foreground">About</Link>
            <Link href="#developers" className="transition-colors hover:text-foreground">Developers</Link>
            <Link href="#contact" className="transition-colors hover:text-foreground">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
