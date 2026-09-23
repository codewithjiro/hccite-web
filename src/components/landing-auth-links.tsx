import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";

const signIn = <Link href="/sign-in" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Sign in</Link>;
const signUp = <Link href="/sign-up" className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Create account</Link>;

export function LandingAuthLinks() {
  if (!(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY)) {
    return <>{signIn}{signUp}</>;
  }

  return <>
    <Show when="signed-out">{signIn}{signUp}</Show>
    <Show when="signed-in">
      <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-semibold text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Workspace</Link>
      <UserButton userProfileMode="navigation" userProfileUrl="/profile" fallback={<span role="status" className="text-sm text-muted-foreground">Loading account…</span>} />
    </Show>
  </>;
}
