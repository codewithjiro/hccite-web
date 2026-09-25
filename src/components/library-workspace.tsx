"use client";

import { useCallback, useEffect, useState } from "react";
import { CitationPanel } from "~/components/citation-panel";
import { toast } from "sonner";

type Resource = { id: string; title: string; type: string; authors: string[]; year: number | null; venue: string | null; publisher: string | null; doi: string | null; isbn: string | null; source: string; url: string | null };
type Saved = { id: string; resourceId: string; readingStatus: "unread" | "reading" | "read"; notes: string | null };
type Collection = { id: string; name: string };
type Tag = { id: string; name: string };
type LibraryData = { saved: { saved: Saved; resource: Resource }[]; collections: Collection[]; tags: Tag[]; tagLinks: { savedResourceId: string; tagId: string }[]; collectionLinks: { resourceId: string; collectionId: string }[] };

export function LibraryWorkspace() {
  const [data, setData] = useState<LibraryData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [tagName, setTagName] = useState("");
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    try { const response = await fetch("/api/library", { cache: "no-store" }); if (!response.ok) throw new Error(); setData(await response.json() as LibraryData); setError(""); }
    catch { setError("Your library could not be loaded. Retry shortly."); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  async function act(payload: Record<string, unknown>): Promise<boolean> {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "The change could not be saved.");
      await refresh();
      const success: Record<string, string> = {
        unsave: "Resource removed successfully.", updateSaved: "Changes saved successfully.", createCollection: "Collection created successfully.",
        renameCollection: "Collection updated successfully.", deleteCollection: "Collection deleted successfully.", addCollection: "Resource added to collection.",
        removeCollection: "Resource removed from collection.", createTag: "Tag created successfully.", deleteTag: "Tag deleted successfully.",
        attachTag: "Tag added successfully.", removeTag: "Tag removed successfully.",
      };
      toast.success(success[String(payload.action)] ?? "Changes saved successfully.");
      return true;
    } catch (caught) { toast.error(caught instanceof Error ? caught.message : "The change could not be saved."); return false; }
    finally { setBusy(false); }
  }
  return <section className="mx-auto max-w-5xl space-y-6">
    <header><p className="text-xs font-bold uppercase tracking-widest text-primary">Your research</p><h1 className="mt-2 text-3xl font-bold">Saved Sources & Collections</h1><p className="mt-2 text-sm text-muted-foreground">Bibliographic metadata is shared. Your notes, reading status, tags, and collections are private.</p></header>
    {error && <div role="alert" className="rounded-xl border border-destructive/40 p-3 text-sm">{error} <button onClick={() => void refresh()} className="underline">Retry</button></div>}
    {!data && !error && <p role="status">Loading your library…</p>}
    {data && <>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-4"><h2 className="font-semibold">Collections</h2><form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void act({ action: "createCollection", name: collectionName }).then((saved) => { if (saved) setCollectionName(""); }); }}><input aria-label="New collection name" maxLength={160} required value={collectionName} onChange={(e) => setCollectionName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3"/><button disabled={busy} className="min-h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground">Create</button></form><div className="mt-3 flex flex-wrap gap-2"><button onClick={() => setSelectedCollection(null)} className="rounded-lg border border-border px-3 py-2 text-sm">All sources</button>{data.collections.map((c) => <button key={c.id} onClick={() => setSelectedCollection(c.id)} className={`rounded-lg border px-3 py-2 text-sm ${selectedCollection === c.id ? "border-primary" : "border-border"}`}>{c.name}</button>)}</div>{selectedCollection && <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={() => { const name = prompt("Rename collection", data.collections.find((c) => c.id === selectedCollection)?.name); if (name?.trim()) void act({ action: "renameCollection", collectionId: selectedCollection, name }); }} className="text-sm underline">Rename</button><button disabled={busy} onClick={() => { if (confirm("Delete this collection? Sources will stay saved.")) void act({ action: "deleteCollection", collectionId: selectedCollection }).then(() => setSelectedCollection(null)); }} className="text-sm text-destructive underline">Delete collection</button></div>}</div>
        <div className="rounded-2xl border border-border bg-card p-4"><h2 className="font-semibold">Your tags</h2><form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); void act({ action: "createTag", name: tagName }).then((saved) => { if (saved) setTagName(""); }); }}><input aria-label="New tag name" maxLength={80} required value={tagName} onChange={(e) => setTagName(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3"/><button disabled={busy} className="min-h-10 rounded-lg bg-primary px-3 text-sm text-primary-foreground">Create</button></form><div className="mt-3 flex flex-wrap gap-2">{data.tags.map((tag) => <span key={tag.id} className="rounded-lg border border-border px-2 py-1 text-sm">{tag.name} <button disabled={busy} aria-label={`Delete tag ${tag.name}`} onClick={() => void act({ action: "deleteTag", tagId: tag.id })} className="ml-1 text-destructive">×</button></span>)}</div></div>
      </div>
      <h2 className="text-xl font-semibold">{selectedCollection ? data.collections.find((c) => c.id === selectedCollection)?.name ?? "Collection" : "All saved sources"}</h2>
      {data.saved.filter(({ resource }) => !selectedCollection || data.collectionLinks.some((l) => l.collectionId === selectedCollection && l.resourceId === resource.id)).length === 0 && <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">No sources here yet. Discover an article or book and save it to your library.</p>}
      {data.saved.filter(({ resource }) => !selectedCollection || data.collectionLinks.some((l) => l.collectionId === selectedCollection && l.resourceId === resource.id)).map(({ saved, resource }) => <SavedCard key={saved.id} saved={saved} resource={resource} data={data} act={act} busy={busy} />)}
    </>}
  </section>;
}

function SavedCard({ saved, resource, data, act, busy }: { saved: Saved; resource: Resource; data: LibraryData; act: (payload: Record<string, unknown>) => Promise<boolean>; busy: boolean }) {
  const [notes, setNotes] = useState(saved.notes ?? "");
  useEffect(() => setNotes(saved.notes ?? ""), [saved.notes]);
  return <article className="rounded-2xl border border-border bg-card p-5 space-y-4">
    <div><span className="text-xs font-semibold uppercase text-primary">Shared bibliographic metadata · {resource.source}</span><h3 className="mt-2 text-lg font-semibold">{resource.title}</h3><p className="text-sm text-muted-foreground">{resource.authors.join(", ") || "Author unavailable"} · {resource.year ?? "Year unavailable"} · {resource.venue ?? resource.publisher ?? "Publication unavailable"}</p>{resource.doi && <p className="break-all text-sm">DOI: {resource.doi}</p>}{resource.isbn && <p className="text-sm">ISBN: {resource.isbn}</p>}</div>
    <div className="border-t border-border pt-4"><span className="text-xs font-semibold uppercase text-primary">Your private source state</span><div className="mt-2 flex flex-wrap items-center gap-3"><label className="text-sm">Reading status <select disabled={busy} value={saved.readingStatus} onChange={(e) => void act({ action: "updateSaved", savedResourceId: saved.id, readingStatus: e.target.value })} className="ml-2 min-h-10 rounded-lg border border-input bg-background px-2"><option value="unread">Unread</option><option value="reading">Reading</option><option value="read">Read</option></select></label><button disabled={busy} onClick={() => { if (confirm("Remove this source from your library?")) void act({ action: "unsave", savedResourceId: saved.id }); }} className="min-h-10 rounded-lg border border-destructive/50 px-3 text-sm text-destructive">Unsave</button></div>
    <label className="mt-3 block text-sm">Private notes<textarea maxLength={10000} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-input bg-background p-3" /></label><button disabled={busy || notes === (saved.notes ?? "")} onClick={() => void act({ action: "updateSaved", savedResourceId: saved.id, notes })} className="min-h-10 rounded-lg border border-border px-3 text-sm disabled:opacity-50">Save notes</button>
    <div className="mt-4 flex flex-wrap gap-2">{data.tags.map((tag) => { const attached = data.tagLinks.some((l) => l.savedResourceId === saved.id && l.tagId === tag.id); return <button key={tag.id} disabled={busy} onClick={() => void act({ action: attached ? "removeTag" : "attachTag", savedResourceId: saved.id, tagId: tag.id })} className={`rounded-lg border px-3 py-2 text-sm ${attached ? "border-primary bg-primary/10" : "border-border"}`}>{attached ? "✓ " : "+ "}{tag.name}</button>; })}</div>
    <div className="mt-3 flex flex-wrap gap-2">{data.collections.map((collection) => { const attached = data.collectionLinks.some((l) => l.resourceId === resource.id && l.collectionId === collection.id); return <button key={collection.id} disabled={busy} onClick={() => void act({ action: attached ? "removeCollection" : "addCollection", collectionId: collection.id, resourceId: resource.id })} className={`rounded-lg border px-3 py-2 text-sm ${attached ? "border-primary bg-primary/10" : "border-border"}`}>{attached ? "✓ " : "+ "}{collection.name}</button>; })}</div></div>
    <CitationPanel resourceId={resource.id} />
  </article>;
}
