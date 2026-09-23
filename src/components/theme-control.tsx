"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeControl() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <label className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm text-foreground shadow-sm focus-within:ring-2 focus-within:ring-ring">
      {mounted && resolvedTheme === "dark" ? <Moon aria-hidden="true" className="size-4" /> : <Sun aria-hidden="true" className="size-4" />}
      <span className="sr-only sm:not-sr-only">Theme</span>
      <select
        aria-label="Theme"
        className="min-h-10 bg-transparent outline-none"
        value={mounted ? theme : "system"}
        onChange={(event) => setTheme(event.target.value)}
      >
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </label>
  );
}
