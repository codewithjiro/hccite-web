"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { BookOpen, ChartNoAxesCombined, FileSearch, Files, LibraryBig, Menu, SearchCheck, Sparkles, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Brand } from "~/components/brand";
import { ThemeControl } from "~/components/theme-control";
import { featureGroups } from "~/lib/features";

const icons = [ChartNoAxesCombined, FileSearch, SearchCheck, BookOpen, Sparkles, Files, LibraryBig];

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  let iconIndex = 0;

  const navigation = (
    <nav aria-label="Workspace navigation" className="space-y-6">
      {featureGroups.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{group.label}</p>
          <div className="mt-2 space-y-1">
            {group.items.map((item) => {
              const Icon = icons[iconIndex++]!;
              const active = pathname === item.href || (item.href === "/studies" && pathname.startsWith("/studies/"));
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} aria-current={active ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring ${active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className="min-w-0 flex-1">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      <a href="#workspace-main" className="skip-link">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex min-h-17 items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="mobile-workspace-nav" onClick={() => setMenuOpen((open) => !open)} className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring md:hidden">
              {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            </button>
            <Brand compact />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeControl />
            <Link href="/" className="hidden min-h-11 items-center rounded-xl px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:inline-flex">Home</Link>
            <Link href="/profile" aria-label="My account" className="hidden min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring sm:inline-flex"><UserRound aria-hidden="true" className="size-4" /><span className="hidden lg:inline">My account</span></Link>
            <UserButton userProfileMode="navigation" userProfileUrl="/profile" fallback={<span role="status" className="text-xs text-muted-foreground">Loading…</span>} />
          </div>
        </div>
        {menuOpen && <div id="mobile-workspace-nav" className="max-h-[calc(100vh-4.25rem)] overflow-y-auto border-t border-border bg-card p-4 md:hidden">{navigation}</div>}
      </header>
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-17 hidden h-[calc(100vh-4.25rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-card p-4 md:block" aria-label="Workspace sidebar">{navigation}</aside>
        <main id="workspace-main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
