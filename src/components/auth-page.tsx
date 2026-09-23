import Link from "next/link";
import { SignIn, SignUp } from "@clerk/nextjs";
import { ArrowLeft, UserRound } from "lucide-react";
import { Brand } from "~/components/brand";
import { ThemeControl } from "~/components/theme-control";

export function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  const heading = mode === "sign-in" ? "Sign in" : "Create account";
  const clerkConfigured = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );

  return (
    <div className="min-h-screen bg-background">
      <a href="#auth-main" className="skip-link">Skip to content</a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
        <Brand />
        <ThemeControl />
      </header>
      <main id="auth-main" className="mx-auto max-w-lg px-4 py-12 sm:py-20">
        <div className="mb-7 text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRound aria-hidden="true" className="size-6" /></span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight">{heading}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your HCCite research workspace starts here.</p>
        </div>
        {clerkConfigured ? (
          <div className="flex justify-center">
            {mode === "sign-in" ? (
              <SignIn fallback={<p role="status" className="p-6 text-muted-foreground">Loading sign-in…</p>} />
            ) : (
              <SignUp fallback={<p role="status" className="p-6 text-muted-foreground">Loading sign-up…</p>} />
            )}
          </div>
        ) : (
          <div role="alert" className="rounded-2xl border border-border bg-card p-6 text-sm leading-6 shadow-sm">
            <p className="font-semibold">Account access needs Clerk configuration.</p>
            <p className="mt-2 text-muted-foreground">Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to your local environment, then restart the app. The research workspace remains protected until both keys are set.</p>
          </div>
        )}
        <Link href="/" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><ArrowLeft aria-hidden="true" className="size-4" /> Back to HCCite</Link>
      </main>
    </div>
  );
}
