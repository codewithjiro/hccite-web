import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { findFeature } from "~/lib/features";

export function ComingSoon({ path }: { path: string }) {
  const feature = findFeature(path);
  if (!feature) return null;
  const backToHome = path === "/dashboard";
  return (
    <div className="mx-auto max-w-3xl py-6 sm:py-12">
      <div className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-10">
        <div className="mb-7 inline-flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
          <LockKeyhole aria-hidden="true" className="size-6" />
        </div>
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">Planned for phase {feature.phase}</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{feature.label}</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{feature.description}</p>
        <p className="mt-5 rounded-xl border border-border bg-muted p-4 text-sm leading-6 text-muted-foreground">
          This route is a preview of the workspace structure. It does not search, save, analyze, or display research data yet.
        </p>
        <Link href={backToHome ? "/" : "/dashboard"} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <ArrowLeft aria-hidden="true" className="size-4" /> {backToHome ? "Back to HCCite" : "Back to workspace preview"}
        </Link>
      </div>
    </div>
  );
}
