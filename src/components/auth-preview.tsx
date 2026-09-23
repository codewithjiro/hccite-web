import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { Brand } from "~/components/brand";
import { ThemeControl } from "~/components/theme-control";

export function AuthPreview({ mode }: { mode: "sign-in" | "sign-up" }) {
  const heading = mode === "sign-in" ? "Sign in" : "Create account";
  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Brand />
        <ThemeControl />
      </header>
      <main className="mx-auto max-w-lg px-4 py-16 sm:py-24">
        <div className="rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-10">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRound aria-hidden="true" className="size-6" /></span>
          <h1 className="mt-6 text-3xl font-bold tracking-tight">{heading}</h1>
          <p className="mt-4 leading-7 text-muted-foreground">Account access will be available in Phase 02, when Clerk authentication is connected. There is no sign-in form in this foundation preview.</p>
          <Link href="/" className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" /> Back to HCCite</Link>
        </div>
      </main>
    </div>
  );
}
