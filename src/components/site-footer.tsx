import Link from "next/link";

export function SiteFooter() {
  return <footer className="border-t border-border bg-card/70 px-4 py-8 text-sm text-muted-foreground sm:px-6">
    <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
      <p>HCCite · Holy Cross College research workspace</p>
      <nav aria-label="Footer navigation" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href="/#about" className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">About</Link>
        <Link href="/#developers" className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Developers</Link>
        <Link href="/#contact" className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Contact</Link>
        <Link href="mailto:hccite@hcc.edu" className="rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">Email</Link>
      </nav>
    </div>
  </footer>;
}
