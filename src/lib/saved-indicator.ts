import { isbn13FromIsbn10, normalizeIsbn } from "~/server/discovery/normalization";

type Identity = { source: string; sourceIdentifier: string | null; doi: string | null; isbn: string | null };
type SavedIdentity = Identity & { citationMetadata: Record<string, unknown> };

/** Compares provider identifiers with canonical identifiers and recorded provider provenance. */
export function findSavedId(resource: Identity, saved: { saved: { id: string }; resource: SavedIdentity }[]): string | undefined {
  const canonicalIsbn = normalizeIsbn(resource.isbn);
  const isbn13 = canonicalIsbn?.length === 10 ? isbn13FromIsbn10(canonicalIsbn) : canonicalIsbn;
  return saved.find((item) => {
    const savedIsbn = normalizeIsbn(item.resource.isbn);
    const savedIsbn13 = savedIsbn?.length === 10 ? isbn13FromIsbn10(savedIsbn) : savedIsbn;
    const provenance = item.resource.citationMetadata.provenance;
    const providerMatch = !!resource.sourceIdentifier && item.resource.source === resource.source && item.resource.sourceIdentifier === resource.sourceIdentifier
      || Array.isArray(provenance) && provenance.some((entry) => entry && typeof entry === "object" && "provider" in entry && "providerIdentifier" in entry && entry.provider === resource.source && entry.providerIdentifier === resource.sourceIdentifier);
    return !!(resource.doi && item.resource.doi === resource.doi || isbn13 && savedIsbn13 === isbn13 || providerMatch);
  })?.saved.id;
}
