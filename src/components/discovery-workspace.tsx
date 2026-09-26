"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { AlertCircle, ArrowUpRight, BookOpen, LoaderCircle, Search, Save } from "lucide-react";
import type { NormalizedResource } from "~/server/discovery/normalization";
import { findSavedId } from "~/lib/saved-indicator";
import { CitationPanel } from "~/components/citation-panel";
import { formatPhilippineDateTime } from "~/lib/dates";
import { toast } from "sonner";

type DiscoveryKind = "articles" | "books" | "doi";
type ProviderError = { provider: string | null; code: string; message: string; retryable: boolean };
type SearchResult = { items?: NormalizedResource[]; item?: NormalizedResource; resource?: NormalizedResource; doiFound?: boolean; verification?: "unknown"; total?: number; hasMore?: boolean; page?: number; startIndex?: number };

const titles: Record<DiscoveryKind, { heading: string; description: string; placeholder: string; provider: string }> = {
  articles: { heading: "Research Articles", description: "Search scholarly works indexed by OpenAlex.", placeholder: "Search titles, topics, authors, or keywords", provider: "OpenAlex" },
  books: { heading: "Book Discovery", description: "Search public book metadata from Google Books.", placeholder: "Search book titles, authors, or subjects", provider: "Google Books" },
  doi: { heading: "DOI & Citation Lookup", description: "Look up a DOI or find records by title in Crossref.", placeholder: "Enter a DOI or title", provider: "Crossref" },
};

function metadata(resource: NormalizedResource, key: string) {
  const value = resource.citationMetadata[key];
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}
function metaValue(resource: NormalizedResource, key: string): unknown { return resource.citationMetadata[key]; }
function providerLabel(source: string) { return source === "openalex" ? "OpenAlex" : source === "google_books" ? "Google Books" : "Crossref"; }

export function DiscoveryWorkspace({ kind }: { kind: DiscoveryKind }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"doi" | "title">("doi");
  const [page, setPage] = useState(1);
  const [startIndex, setStartIndex] = useState(0);
  const [yearFrom, setYearFrom] = useState("");
  const [bookYear, setBookYear] = useState("");
  const [openAccess, setOpenAccess] = useState("any");
  const [results, setResults] = useState<NormalizedResource[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<ProviderError | null>(null);
  const [status, setStatus] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [library, setLibrary] = useState<{ saved: { saved: { id: string }; resource: { id: string; doi: string | null; isbn: string | null; source: string; sourceIdentifier: string | null; citationMetadata: Record<string, unknown> } }[]; collections: { id: string; name: string }[] } | null>(null);
  const searchInFlight = useRef(false);
  const config = titles[kind];

  async function refreshLibrary() {
    try { const response = await fetch("/api/library", { cache: "no-store" }); if (response.ok) setLibrary(await response.json()); } catch { /* Discovery remains usable if personal state is temporarily unavailable. */ }
  }

  async function runSearch(nextPage = 1, nextStartIndex = 0, append = false) {
    if (searchInFlight.current) return;
    const q = query.trim();
    if (!q) {
      const validationError = { provider: config.provider, code: "invalid_input", message: "Enter a search term to continue.", retryable: false };
      setError(validationError);
      toast.error(validationError.message);
      return;
    }
    searchInFlight.current = true;
    setLoading(true); setError(null); setStatus(""); setHasSearched(true); setPage(nextPage); setStartIndex(nextStartIndex);
    try {
      let url: string;
      if (kind === "articles") {
        const params = new URLSearchParams({ q, page: String(nextPage) });
        if (yearFrom) params.set("yearFrom", yearFrom);
        if (openAccess !== "any") params.set("openAccess", openAccess);
        url = `/api/discovery/openalex?${params}`;
      } else if (kind === "books") {
        const params = new URLSearchParams({ q, startIndex: String(nextStartIndex) });
        if (bookYear) params.set("year", bookYear);
        url = `/api/discovery/books?${params}`;
      } else {
        url = `/api/discovery/crossref?${new URLSearchParams({ q, mode })}`;
      }
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      const payload = await response.json() as SearchResult & { error?: ProviderError };
      if (!response.ok) throw payload.error ?? { provider: config.provider, code: "unknown", message: `${config.provider} request failed.`, retryable: true };
      void refreshLibrary();
      const found = payload.items ?? (payload.resource ? [payload.resource] : []);
      setResults((current) => append ? [...current, ...found] : found);
      setTotal(payload.total ?? found.length);
      setHasMore(payload.hasMore ?? false);
      setPage(nextPage); setStartIndex(nextStartIndex);
      if (found.length && !append && nextPage === 1) toast.success(`Found ${found.length} ${found.length === 1 ? "record" : "records"}.`);
      if (payload.doiFound) setStatus("Crossref metadata found. Save or associate this canonical source to check Source Health; a DOI string alone is not verification.");
      if (!found.length) setStatus("No matching records were returned.");
    } catch (caught) {
      const candidate = caught && typeof caught === "object" ? caught as Partial<ProviderError> : null;
      const providerError: ProviderError = candidate && typeof candidate.code === "string" && typeof candidate.message === "string"
        ? { provider: candidate.provider ?? config.provider, code: candidate.code, message: candidate.message, retryable: candidate.retryable === true }
        : { provider: config.provider, code: "network_error", message: `${config.provider} could not be reached. Check your connection and retry.`, retryable: true };
      setError(providerError);
      toast.error(providerError.message);
      if (!append) setResults([]);
    } finally { searchInFlight.current = false; setLoading(false); }
  }

  async function save(resource: NormalizedResource) {
    setStatus("");
    setMutating(true);
    try {
      const providerIdentifier = resource.source === "crossref" ? resource.doi : resource.sourceIdentifier;
      if (!providerIdentifier || resource.source === "manual") throw new Error("This provider record has no stable ID and cannot be saved.");
      const response = await fetch("/api/resources/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: resource.source, providerIdentifier }) });
      const payload = await response.json() as { saved?: boolean; reused?: boolean; ambiguous?: boolean; error?: string | ProviderError };
      if (!response.ok) throw new Error(typeof payload.error === "object" ? payload.error.message : payload.error ?? "Could not save this resource.");
      toast.success(payload.ambiguous ? "Resource saved separately because similar records were ambiguous." : "Resource saved successfully.");
      await refreshLibrary();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Failed to save resource."); }
    finally { setMutating(false); }
  }

  async function addToCollection(resource: NormalizedResource, collectionId: string) {
    const providerIdentifier = resource.source === "crossref" ? resource.doi : resource.sourceIdentifier;
    if (!providerIdentifier || resource.source === "manual") return;
    setMutating(true);
    try {
      const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "saveToCollection", collectionId, locator: { provider: resource.source, providerIdentifier } }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not add the source.");
      toast.success("Resource added to collection."); await refreshLibrary();
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "Failed to add resource to collection."); }
    finally { setMutating(false); }
  }

  async function unsave(savedResourceId: string) {
    setMutating(true);
    try {
      const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsave", savedResourceId }) });
      if (!response.ok) throw new Error();
      toast.success("Resource removed from your library."); await refreshLibrary();
    } catch { toast.error("Failed to remove resource. Please try again."); }
    finally { setMutating(false); }
  }

  function savedIdFor(resource: NormalizedResource) {
    return findSavedId(resource, library?.saved ?? []);
  }

  const next = () => kind === "books" ? runSearch(1, startIndex + 20, true) : runSearch(page + 1, 0, true);

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Discovery</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{config.heading}</h1>
        <p className="max-w-2xl text-muted-foreground">{config.description}</p>
      </header>

      <form className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6" onSubmit={(event) => { event.preventDefault(); setResults([]); void runSearch(1, 0); }}>
        {kind === "doi" && <div className="mb-3 flex gap-2" role="group" aria-label="Lookup type">
          <button type="button" onClick={() => setMode("doi")} aria-pressed={mode === "doi"} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${mode === "doi" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>DOI lookup</button>
          <button type="button" onClick={() => setMode("title")} aria-pressed={mode === "title"} className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${mode === "title" ? "bg-primary text-primary-foreground" : "border border-border hover:bg-muted"}`}>Title search</button>
        </div>}
        <label htmlFor="discovery-query" className="mb-2 block text-sm font-semibold">{kind === "doi" && mode === "doi" ? "DOI" : "Search terms"}</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input id="discovery-query" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={kind === "doi" && mode === "doi" ? "10.1234/example or https://doi.org/..." : config.placeholder} className="min-h-12 w-full min-w-0 rounded-xl border border-input bg-background py-2 pl-10 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" autoComplete="off" />
          </div>
          <button type="submit" disabled={loading} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
            {loading ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Search aria-hidden="true" className="size-4" />}{loading ? "Searching…" : "Search"}
          </button>
        </div>
        {kind === "articles" && <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span className="font-medium">Published from</span><input type="number" min="1000" max={new Date().getFullYear()} value={yearFrom} onChange={(event) => setYearFrom(event.target.value)} placeholder="Any year" className="min-h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring" /></label>
          <label className="space-y-1 text-sm"><span className="font-medium">Open Access</span><select value={openAccess} onChange={(event) => setOpenAccess(event.target.value)} className="min-h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="any">Any access status</option><option value="true">OpenAlex reports open access</option><option value="false">OpenAlex reports not open access</option></select></label>
        </div>}
        {kind === "books" && <label className="mt-4 block space-y-1 text-sm"><span className="font-medium">Publication year</span><input type="number" min="1000" max={new Date().getFullYear()} value={bookYear} onChange={(event) => { setBookYear(event.target.value); setResults([]); setHasSearched(false); setHasMore(false); }} placeholder="Any year" className="min-h-11 w-full rounded-xl border border-input bg-background px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-48" /></label>}
        <p className="mt-3 text-xs text-muted-foreground">Source: {config.provider}. Metadata below is provider supplied; missing fields are left blank.</p>
      </form>

      {loading && <div role="status" className="flex items-center gap-3 rounded-2xl border border-border bg-card p-6 text-sm"><LoaderCircle className="size-5 animate-spin text-primary" /> Searching {config.provider}…</div>}
      {error && <div role="alert" className="rounded-2xl border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex gap-3"><AlertCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" /><div className="min-w-0"><h2 className="font-semibold">{error.code === "invalid_input" ? "Check your search" : error.code === "missing_credentials" || error.code === "invalid_credentials" ? "Provider setup required" : error.code === "quota_exhausted" || error.code === "rate_limited" ? "Provider rate limit reached" : error.code === "not_found" ? "No DOI record found" : error.code === "provider_outage" || error.code === "timeout" || error.code === "network_error" ? "Provider unavailable" : error.code === "malformed_response" ? "Provider response could not be read" : "Search failed"}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{error.message}</p>
          {error.retryable && <button type="button" onClick={() => void runSearch(page, startIndex)} className="mt-3 min-h-10 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">Retry</button>}
        </div></div>
      </div>}
      {status && !error && <p role="status" className="break-words rounded-xl border border-border bg-muted/50 p-4 text-sm">{status}</p>}
      {!loading && hasSearched && !error && results.length === 0 && <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center"><BookOpen className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">No matching results in this batch</h2><p className="mt-1 text-sm text-muted-foreground">{hasMore ? "Load more to check the next books, or try another search." : "Try a broader query or check the spelling."}</p></div>}
      {(!!results.length || (kind === "books" && hasMore && hasSearched)) && <div className="space-y-4">
        {!!results.length && <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Results</h2><span className="text-sm text-muted-foreground">{kind === "books" && bookYear ? `${results.length} shown` : total === null ? results.length : `${results.length} shown${total ? ` · ${total.toLocaleString()} reported` : ""}`}</span></div>}
        {results.map((resource, index) => <ResultCard key={`${resource.source}-${resource.sourceIdentifier}-${index}`} resource={resource} onSave={save} onUnsave={unsave} onAddCollection={addToCollection} savedId={savedIdFor(resource)} collections={library?.collections ?? []} busy={mutating} />)}
        {hasMore && <div className="flex justify-center"><button type="button" disabled={loading} onClick={next} className="min-h-12 rounded-xl border border-border bg-card px-6 text-sm font-semibold hover:bg-muted disabled:opacity-60">{loading ? "Loading…" : "Load more"}</button></div>}
      </div>}
    </section>
  );
}

function ResultCard({ resource, onSave, onUnsave, onAddCollection, savedId, collections, busy }: { resource: NormalizedResource; onSave: (resource: NormalizedResource) => void; onUnsave: (id: string) => void; onAddCollection: (resource: NormalizedResource, id: string) => void; savedId?: string; collections: { id: string; name: string }[]; busy: boolean }) {
  const openAccess = metadata(resource, "openAccess");
  const cover = metaValue(resource, "coverImageUrl");
  const coverImageUrl = typeof cover === "string" ? cover : null;
  const doiUrl = resource.doi ? `https://doi.org/${resource.doi}` : null;
  const sourceUrl = resource.url;
  const canSave = resource.source !== "manual" && !!(resource.source === "crossref" ? resource.doi : resource.sourceIdentifier);
  return <article className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:p-6">
      {resource.type === "book" && <div className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted sm:size-32">{coverImageUrl ? <Image src={coverImageUrl} alt={`Cover for ${resource.title}`} width={128} height={160} unoptimized className="h-full w-full object-cover" /> : <BookOpen aria-hidden="true" className="size-9 text-muted-foreground" />}</div>}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-xs"><span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">{providerLabel(resource.source)}</span>{openAccess?.isOpenAccess === true && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-700 dark:text-emerald-300">Open Access per OpenAlex</span>}</div>
        <h3 className="mt-3 break-words text-lg font-semibold leading-snug">{resource.title}</h3>
        <p className="mt-1 break-words text-sm text-muted-foreground">{resource.authors.length ? resource.authors.join(", ") : "Author information not provided"}{resource.year ? ` · ${resource.year}` : ""}</p>
        {(resource.venue || resource.publisher) && <p className="mt-2 break-words text-sm">{resource.venue ?? resource.publisher}</p>}
        {resource.doi && <p className="mt-2 break-all text-sm"><span className="text-muted-foreground">DOI: </span>{resource.doi}</p>}
        {resource.isbn && <p className="mt-1 break-all text-sm"><span className="text-muted-foreground">ISBN: </span>{resource.isbn}</p>}
        {resource.abstract && <p className="mt-3 line-clamp-5 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">{resource.abstract}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {canSave ? savedId ? <button type="button" disabled={busy} onClick={() => onUnsave(savedId)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary px-3.5 text-sm font-semibold text-primary disabled:opacity-60"><Save aria-hidden="true" className="size-4" />Saved · Unsave</button> : <button type="button" disabled={busy} onClick={() => onSave(resource)} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"><Save aria-hidden="true" className="size-4" />Save to library</button> : <span className="text-xs text-muted-foreground">Provider record has no stable ID for saving.</span>}
          {canSave && collections.length > 0 && <select disabled={busy} aria-label={`Add ${resource.title} to collection`} defaultValue="" onChange={(e) => { if (e.target.value) onAddCollection(resource, e.target.value); e.target.value = ""; }} className="min-h-10 max-w-full rounded-xl border border-border bg-background px-3 text-sm disabled:opacity-60"><option value="">Add to collection…</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select>}
          {doiUrl && <a href={doiUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-semibold hover:bg-muted">DOI <ArrowUpRight aria-hidden="true" className="size-4" /></a>}
          {sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-semibold hover:bg-muted">Source record <ArrowUpRight aria-hidden="true" className="size-4" /></a>}
          {typeof metaValue(resource, "previewUrl") === "string" && <a href={String(metaValue(resource, "previewUrl"))} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3.5 text-sm font-semibold hover:bg-muted">Preview <ArrowUpRight aria-hidden="true" className="size-4" /></a>}
        </div>
        {canSave && <CitationPanel locator={{ provider: resource.source as "openalex" | "crossref" | "google_books", providerIdentifier: (resource.source === "crossref" ? resource.doi : resource.sourceIdentifier)! }} />}
      </div>
    </div>
    <footer className="border-t border-border px-5 py-3 text-xs text-muted-foreground sm:px-6">Provider ID: <span className="break-all">{resource.sourceIdentifier}</span>{resource.retrievedAt && <> · Retrieved {formatPhilippineDateTime(resource.retrievedAt)}</>}</footer>
  </article>;
}
