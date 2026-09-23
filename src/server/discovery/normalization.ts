import { z } from "zod";

export const providerSchema = z.enum(["openalex", "crossref", "google_books"]);
const resourceSourceSchema = z.enum(["openalex", "crossref", "google_books", "manual"]);
export const resourceTypeSchema = z.enum(["article", "book", "other"]);

export const normalizedResourceSchema = z.object({
  type: resourceTypeSchema,
  title: z.string().trim().min(1).max(10_000),
  authors: z.array(z.string().trim().min(1).max(500)).max(500),
  year: z.number().int().min(1000).max(3000).nullable(),
  publicationDate: z.string().max(32).nullable(),
  doi: z.string().max(512).nullable(),
  isbn: z.string().max(20).nullable(),
  publisher: z.string().max(10_000).nullable(),
  venue: z.string().max(10_000).nullable(),
  source: resourceSourceSchema,
  sourceIdentifier: z.string().min(1).max(512).nullable(),
  url: z.string().url().max(10_000).nullable(),
  abstract: z.string().max(100_000).nullable(),
  retrievedAt: z.coerce.date(),
  citationMetadata: z.record(z.string(), z.unknown()).default({}),
});

export type NormalizedResource = z.infer<typeof normalizedResourceSchema>;

export function normalizeDoi(value: string | null | undefined): string | null {
  if (!value) return null;
  let doi = value.trim();
  doi = doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  doi = doi.replace(/[\s<>]+$/g, "").trim().toLowerCase();
  return /^10\.\d{4,9}\/\S+$/.test(doi) ? doi : null;
}

export function normalizeIsbn(value: string | null | undefined): string | null {
  if (!value) return null;
  const isbn = value.replace(/[^0-9x]/gi, "").toUpperCase();
  if (isbn.length === 10) {
    if (!/^\d{9}[\dX]$/.test(isbn)) return null;
    const checksum = [...isbn].reduce((sum, char, index) => sum + (char === "X" ? 10 : Number(char)) * (10 - index), 0);
    return checksum % 11 === 0 ? isbn : null;
  }
  if (isbn.length === 13 && /^\d{13}$/.test(isbn)) {
    const checksum = [...isbn.slice(0, 12)].reduce((sum, char, index) => sum + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
    return (10 - (checksum % 10)) % 10 === Number(isbn[12]) ? isbn : null;
  }
  return null;
}

export function isbn13FromIsbn10(isbn10: string): string | null {
  const normalized = normalizeIsbn(isbn10);
  if (!normalized || normalized.length !== 10) return null;
  const body = `978${normalized.slice(0, 9)}`;
  const checksum = [...body].reduce((sum, char, index) => sum + Number(char) * (index % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (checksum % 10)) % 10}`;
}

export function isbn10FromIsbn13(isbn13: string): string | null {
  const normalized = normalizeIsbn(isbn13);
  if (!normalized || !normalized.startsWith("978")) return null;
  const body = normalized.slice(3, 12);
  const sum = [...body].reduce((total, char, index) => total + Number(char) * (10 - index), 0) % 11;
  const checksum = (11 - sum) % 11;
  return `${body}${checksum === 10 ? "X" : checksum}`;
}

export function normalizeTitle(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

export function normalizeAuthor(value: string | null | undefined): string | null {
  if (!value) return null;
  const author = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  return author || null;
}

export function safelyRenderUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

const trustRank = { openalex: 1, google_books: 1, crossref: 2, manual: 1 } as const;
const isPresent = (value: unknown) => value !== null && value !== undefined && value !== "";

/** Merge rules: known values beat missing values; Crossref ranks above OpenAlex for conflicting
 * article fields; equal-trust providers keep the canonical record's value. A longer non-empty
 * author list may enrich an equal/higher-trust record, while every disagreement remains recorded.
 */
export function mergeNormalizedResources(existing: NormalizedResource, incoming: NormalizedResource): NormalizedResource {
  const incomingRank = trustRank[incoming.source];
  const existingRank = trustRank[existing.source];
  const metadata = { ...existing.citationMetadata, ...incoming.citationMetadata, provider: existing.source };
  const priorSources = Array.isArray(existing.citationMetadata.provenance) ? existing.citationMetadata.provenance : [{
    provider: existing.source, providerIdentifier: existing.sourceIdentifier, sourceUrl: existing.url,
    retrievedAt: existing.retrievedAt.toISOString(), doi: existing.doi, isbn: existing.isbn,
  }];
  const provenance = [...priorSources, {
    provider: incoming.source, providerIdentifier: incoming.sourceIdentifier, sourceUrl: incoming.url,
    retrievedAt: incoming.retrievedAt.toISOString(), doi: incoming.doi, isbn: incoming.isbn,
  }];
  const disagreements: Array<{ field: string; existing: unknown; incoming: unknown; existingProvider: string; incomingProvider: string }> =
    Array.isArray(existing.citationMetadata.providerDisagreements)
      ? existing.citationMetadata.providerDisagreements as typeof disagreements : [];
  for (const field of ["title", "year", "publicationDate", "doi", "isbn", "publisher", "venue", "url", "abstract"] as const) {
    const oldValue = existing[field];
    const newValue = incoming[field];
    if (isPresent(oldValue) && isPresent(newValue) && String(oldValue).toLowerCase() !== String(newValue).toLowerCase()) {
      const disagreement = { field, existing: oldValue, incoming: newValue, existingProvider: existing.source, incomingProvider: incoming.source };
      if (!disagreements.some((item) => JSON.stringify(item) === JSON.stringify(disagreement))) disagreements.push(disagreement);
    }
  }
  if (existing.authors.length && incoming.authors.length && JSON.stringify(existing.authors.map(normalizeAuthor)) !== JSON.stringify(incoming.authors.map(normalizeAuthor))) {
    const disagreement = { field: "authors", existing: existing.authors, incoming: incoming.authors, existingProvider: existing.source, incomingProvider: incoming.source };
    if (!disagreements.some((item) => JSON.stringify(item) === JSON.stringify(disagreement))) disagreements.push(disagreement);
  }
  const choose = <T>(oldValue: T | null, newValue: T | null) => {
    if (!isPresent(oldValue)) return newValue;
    if (!isPresent(newValue)) return oldValue;
    return incomingRank > existingRank ? newValue : oldValue;
  };
  const authors = existing.authors.length === 0 ? incoming.authors
    : incoming.authors.length > existing.authors.length && incomingRank >= existingRank ? incoming.authors : existing.authors;
  return normalizedResourceSchema.parse({
    ...existing,
    title: choose(existing.title, incoming.title)!, authors,
    year: choose(existing.year, incoming.year), publicationDate: choose(existing.publicationDate, incoming.publicationDate),
    doi: normalizeDoi(choose(existing.doi, incoming.doi)), isbn: normalizeIsbn(choose(existing.isbn, incoming.isbn)),
    publisher: choose(existing.publisher, incoming.publisher), venue: choose(existing.venue, incoming.venue),
    url: choose(existing.url, incoming.url), abstract: choose(existing.abstract, incoming.abstract),
    retrievedAt: incoming.retrievedAt,
    citationMetadata: { ...metadata, provenance: provenance.slice(-100), providerDisagreements: disagreements.slice(-100) },
  });
}

export type ResourceMatch<T> = { match: T | null; ambiguous: T[] };

export function conservativeTitleCandidates<T extends { title: string; year: number | null; authors: string[] }>(
  incoming: Pick<NormalizedResource, "title" | "year" | "authors" | "doi" | "isbn">,
  candidates: T[],
): ResourceMatch<T> {
  const title = normalizeTitle(incoming.title);
  const author = normalizeAuthor(incoming.authors[0]);
  if (!title || !incoming.year || !author) return { match: null, ambiguous: [] };
  const exact = candidates.filter((item) => {
    if (normalizeTitle(item.title) !== title || item.year !== incoming.year || normalizeAuthor(item.authors[0]) !== author) return false;
    const candidate = item as T & { doi?: string | null; isbn?: string | null };
    const candidateDoi = normalizeDoi(candidate.doi);
    if (incoming.doi && candidateDoi && incoming.doi !== candidateDoi) return false;
    const candidateIsbn = normalizeIsbn(candidate.isbn);
    if (incoming.isbn && candidateIsbn && incoming.isbn !== candidateIsbn && isbn13FromIsbn10(incoming.isbn) !== candidateIsbn && isbn13FromIsbn10(candidateIsbn) !== incoming.isbn) return false;
    return true;
  });
  return exact.length === 1 ? { match: exact[0]!, ambiguous: [] } : { match: null, ambiguous: exact };
}
