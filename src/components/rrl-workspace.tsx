"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, FileText, LoaderCircle, RefreshCw, Save } from "lucide-react";

type Source = { resource: { id: string; title: string; authors: string[]; year: number | null; abstract: string | null }; citationKey: string; integrity: { check: { status: string; updateLabel: string | null } | null; stale: boolean; refreshError: string | null } | null };
type Draft = { draft: { id: string; content: string; citationStyle: "apa" | "mla" | "chicago"; draftVersion: number; contentHash: string; createdAt: string }; sources: Array<{ membership: { citationKey: string }; resource: { id: string; title: string } }>; bibliography: Array<{ citationKey: string; result: { ok: boolean; text?: string; code?: string } }> };
type Payload = { workspace: { selected: Source[] }; drafts: Array<{ id: string; draftVersion: number; createdAt: string }>; latest: Draft | null };
const emptySources: Source[] = [];

export function RrlWorkspace({ studyId, studyTitle }: { studyId: string; studyTitle: string }) {
  const endpoint = `/api/studies/${studyId}/rrl`;
  const [data, setData] = useState<Payload | null>(null), [style, setStyle] = useState<"apa" | "mla" | "chicago">("apa"), [draft, setDraft] = useState<Draft | null>(null);
  const [pending, setPending] = useState(false), [loading, setLoading] = useState(true), [message, setMessage] = useState<string | null>(null), [retracted, setRetracted] = useState<string[]>([]), [generationRequestId, setGenerationRequestId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch(endpoint, { cache: "no-store" }); const body = await response.json() as Payload & { error?: string }; if (!response.ok) throw new Error(body.error ?? "Could not load the RRL workspace."); setData(body); setDraft(body.latest); if (body.latest) setStyle(body.latest.draft.citationStyle); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load the RRL workspace."); } finally { setLoading(false); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]); // Route is owner-scoped; no source data is supplied by this component.
  const selected = data?.workspace.selected ?? emptySources;
  const confirmedRetracted = selected.filter((source) => source.integrity?.check?.status === "retracted").map((source) => source.resource.id);
  async function generate(confirm = false) {
    setPending(true); setMessage(null);
    const requestId = generationRequestId ?? crypto.randomUUID();
    if (!generationRequestId) setGenerationRequestId(requestId);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "generate", citationStyle: style, generationRequestId: requestId, confirmRetractedSourceIds: confirm ? confirmedRetracted : [] }) });
      const body = await response.json() as { draft?: Draft; requiresRetractedConfirmation?: boolean; retractedSourceIds?: string[]; error?: string };
      if (body.requiresRetractedConfirmation) { setRetracted(body.retractedSourceIds ?? []); return; }
      if (!response.ok || !body.draft) throw new Error(body.error ?? "Generation failed.");
      setDraft(body.draft); setRetracted([]); setGenerationRequestId(null); setMessage("A new immutable RRL generation was saved."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Generation failed."); } finally { setPending(false); }
  }
  async function saveEdit() {
    if (!draft) return; setPending(true); setMessage(null);
    try { const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "saveEdit", draftId: draft.draft.id, content: draft.draft.content, citationStyle: style }) }); const body = await response.json() as { draft?: Draft; error?: string }; if (!response.ok || !body.draft) throw new Error(body.error ?? "Could not save this edit."); setDraft(body.draft); setMessage("Edit saved as a new draft version; prior audit records apply only to the earlier version."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this edit."); } finally { setPending(false); }
  }
  if (loading) return <section className="mt-7 rounded-2xl border border-border bg-card p-8"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />Loading RRL workspace…</p></section>;
  return <section className="mt-7 space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">AI-assisted RRL</p><h2 className="mt-2 text-2xl font-bold">{studyTitle}</h2><p className="mt-2 text-sm text-muted-foreground">Gemini receives only the saved Study Profile and the selected-source snapshot below. Citations are HCCite tokens and the bibliography is formatted from canonical metadata.</p></header>
    {message && <p role="status" className="rounded-xl border border-border bg-muted/50 p-4 text-sm">{message}</p>}
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="font-semibold">Selected source allow-list ({selected.length})</h3><p className="mt-1 text-sm text-muted-foreground">Only these sources can be cited in this generation.</p></div><label className="text-sm font-medium">Citation style<select value={style} onChange={(event) => setStyle(event.target.value as typeof style)} className="mt-1 block min-h-10 rounded-lg border border-input bg-background px-3"><option value="apa">APA</option><option value="mla">MLA</option><option value="chicago">Chicago</option></select></label></div>
      <div className="mt-5 space-y-3">{selected.map((source) => { const state = source.integrity?.check?.status ?? "unknown"; return <article key={source.resource.id} className={`rounded-xl border p-4 ${state === "retracted" ? "border-red-500 bg-red-500/5" : "border-border"}`}><div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold">[{source.citationKey}] {source.resource.title}</h4><span className="rounded-full border border-border px-2 py-0.5 text-xs">{source.resource.abstract ? "Abstract available" : "Title-only context"}</span></div><p className="mt-1 text-sm text-muted-foreground">{source.resource.authors.join(", ") || "Author unavailable"}{source.resource.year ? ` · ${source.resource.year}` : ""}</p><p className={`mt-2 text-sm ${state === "retracted" ? "font-semibold text-red-700 dark:text-red-300" : "text-muted-foreground"}`}>Source Health: {state.replaceAll("_", " ")}{source.integrity?.check?.updateLabel ? ` — ${source.integrity.check.updateLabel}` : state === "unknown" ? " — not known to be clean." : ""}</p></article>; })}{!selected.length && <p className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Choose sources in Related literature before generating.</p>}</div>
      <button disabled={pending || !selected.length} onClick={() => void generate(false)} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{pending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{draft ? "Regenerate RRL" : "Generate RRL"}</button>
    </div>
    {!!retracted.length && <div role="alert" className="rounded-2xl border-2 border-red-600 bg-red-500/10 p-5"><h3 className="flex items-center gap-2 font-semibold text-red-800 dark:text-red-200"><AlertTriangle className="size-5" />Retracted-source review required</h3><p className="mt-2 text-sm">One or more selected sources are marked retracted. Generating will preserve this warning in the draft context. Review the source health evidence before deliberately continuing.</p><button disabled={pending} onClick={() => void generate(true)} className="mt-4 rounded-xl border border-red-700 px-4 py-2 text-sm font-semibold text-red-800 dark:text-red-200">I reviewed the retracted source(s); generate anyway</button></div>}
    {draft && <div className="rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-semibold"><FileText className="size-5" />Editable draft</h3><p className="text-sm text-muted-foreground">Version {draft.draft.draftVersion} · SHA-256 {draft.draft.contentHash.slice(0, 12)}…</p></div><button disabled={pending} onClick={() => void saveEdit()} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold disabled:opacity-60"><Save className="size-4" />Save new version</button></div><textarea aria-label="Editable RRL draft" value={draft.draft.content} onChange={(event) => setDraft((current) => current ? { ...current, draft: { ...current.draft, content: event.target.value } } : current)} className="mt-5 min-h-80 w-full rounded-xl border border-input bg-background p-4 font-mono text-sm leading-6" />
      <section className="mt-5"><h4 className="font-semibold">Trusted bibliography</h4><p className="mt-1 text-xs text-muted-foreground">Formatted by Citation.js/CSL from HCCite metadata, not Gemini text.</p><ol className="mt-3 space-y-2 text-sm">{draft.bibliography.map((entry) => <li key={entry.citationKey}><span className="font-medium">{entry.citationKey}</span> {entry.result.ok ? entry.result.text : "Metadata needs review before this reference can be formatted."}</li>)}</ol></section></div>}
  </section>;
}
