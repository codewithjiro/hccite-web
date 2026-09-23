import "server-only";

import { z } from "zod";
import { env } from "~/env";
import { normalizeIsbn, normalizedResourceSchema, safelyRenderUrl, type NormalizedResource } from "~/server/discovery/normalization";
import { ProviderError, providerJson } from "./shared";

const volumeSchema = z.object({
  id: z.string().min(1).max(512),
  volumeInfo: z.object({ title: z.string().min(1).max(10_000), authors: z.array(z.string().max(500)).max(500).optional(), publisher: z.string().max(10_000).nullable().optional(), publishedDate: z.string().max(32).nullable().optional(), description: z.string().max(100_000).nullable().optional(), industryIdentifiers: z.array(z.object({ type: z.string().max(50), identifier: z.string().max(32) }).passthrough()).max(20).optional(), infoLink: z.string().max(10_000).nullable().optional(), previewLink: z.string().max(10_000).nullable().optional(), imageLinks: z.object({ thumbnail: z.string().max(10_000).nullable().optional(), smallThumbnail: z.string().max(10_000).nullable().optional() }).passthrough().optional() }).passthrough(),
}).passthrough();
const responseSchema = z.object({ totalItems: z.number().int().nonnegative(), items: z.array(volumeSchema).max(40).optional().default([]) }).passthrough();

function mapVolume(volume: z.infer<typeof volumeSchema>, retrievedAt: Date): NormalizedResource {
  const info = volume.volumeInfo;
  const isbn = info.industryIdentifiers?.find((item) => item.type === "ISBN_13")?.identifier
    ?? info.industryIdentifiers?.find((item) => item.type === "ISBN_10")?.identifier ?? null;
  const publicationDate = info.publishedDate ?? null;
  const cover = safelyRenderUrl(info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail);
  return normalizedResourceSchema.parse({
    type: "book", title: info.title, authors: (info.authors ?? []).filter((author) => !!author.trim()),
    year: publicationDate && /^\d{4}/.test(publicationDate) ? Number(publicationDate.slice(0, 4)) : null,
    publicationDate, doi: null, isbn: normalizeIsbn(isbn), publisher: info.publisher ?? null, venue: null,
    source: "google_books", sourceIdentifier: volume.id, url: safelyRenderUrl(info.infoLink) ?? `https://books.google.com/books?id=${encodeURIComponent(volume.id)}`,
    abstract: info.description?.trim() || null, retrievedAt,
    citationMetadata: { provider: "google_books", googleBooksId: volume.id, isbnVariants: (info.industryIdentifiers ?? []).filter((item) => item.type === "ISBN_10" || item.type === "ISBN_13").map((item) => ({ type: item.type, isbn: normalizeIsbn(item.identifier) })).filter((item) => item.isbn !== null), coverImageUrl: cover, previewUrl: safelyRenderUrl(info.previewLink), infoUrl: safelyRenderUrl(info.infoLink) },
  });
}

export async function searchGoogleBooks(query: string, startIndex: number, options: { fetcher?: typeof fetch; apiKey?: string } = {}) {
  const apiKey = options.apiKey ?? env.GOOGLE_BOOKS_API_KEY;
  if (!apiKey) throw new ProviderError("google_books", "missing_credentials", "Google Books API key is not configured.");
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", query); url.searchParams.set("startIndex", String(startIndex)); url.searchParams.set("maxResults", "20");
  url.searchParams.set("printType", "books"); url.searchParams.set("projection", "full"); url.searchParams.set("key", apiKey);
  const payload = await providerJson<unknown>("google_books", url, undefined, options.fetcher);
  const parsed = responseSchema.safeParse(payload);
  if (!parsed.success) throw new ProviderError("google_books", "malformed_response", "Google Books response did not match the expected volumes format.");
  const retrievedAt = new Date();
  return { items: parsed.data.items.map((volume) => mapVolume(volume, retrievedAt)), total: parsed.data.totalItems, startIndex, hasMore: startIndex + parsed.data.items.length < parsed.data.totalItems };
}
