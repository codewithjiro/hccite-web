"use client";

import { useState } from "react";
import type { CitationResult } from "~/server/citation";

type Locator = { provider: "openalex" | "crossref" | "google_books"; providerIdentifier: string };

export function CitationPanel({ locator, resourceId }: { locator?: Locator; resourceId?: string }) {
  const [style, setStyle] = useState<"apa" | "mla" | "chicago">("apa");
  const [result, setResult] = useState<CitationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function generate(nextStyle: typeof style) {
    setStyle(nextStyle); setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/citations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ style: nextStyle, ...(resourceId ? { resourceId } : { locator }) }) });
      if (!response.ok) throw new Error();
      setResult(await response.json() as CitationResult);
    } catch { setError("Citation metadata is unavailable. Please retry."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 rounded-xl border border-border bg-muted/30 p-4">
    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">Citation</span><select aria-label="Citation style" value={style} onChange={(e) => void generate(e.target.value as typeof style)} className="min-h-10 rounded-lg border border-input bg-background px-2 text-sm"><option value="apa">APA</option><option value="mla">MLA</option><option value="chicago">Chicago</option></select><button type="button" disabled={busy} onClick={() => void generate(style)} className="min-h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted disabled:opacity-50">{busy ? "Generating…" : "Generate"}</button></div>
    {result?.ok && <div className="mt-3 space-y-2"><p className="whitespace-pre-wrap break-words text-sm">{result.text}</p><button type="button" onClick={() => void navigator.clipboard.writeText(result.text).then(() => setError("Copied to clipboard.")).catch(() => setError("Could not copy citation."))} className="min-h-10 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted">Copy citation</button></div>}
    {result && !result.ok && <p role="status" className="mt-2 text-sm text-muted-foreground">{result.code === "incomplete_metadata" ? `Citation incomplete: ${result.missing?.join(", ")}. Review the available metadata above.` : "Citation formatting failed. Review the metadata and retry."}</p>}
    {error && <p role="status" className="mt-2 text-sm text-muted-foreground">{error}</p>}
  </div>;
}
