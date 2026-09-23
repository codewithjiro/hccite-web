# Discovery Resource normalization and merge rules

Phase 04 provider adapters validate external JSON and map it to `NormalizedResource` before returning records to the UI or saving them. The database `resource` row remains the shared canonical record; provider observations are retained in `citationMetadata.provenance` and meaningful disagreements in `citationMetadata.providerDisagreements`.

## Identity order

- Articles: normalized DOI, then the same provider plus its stable provider identifier, then exact normalized title + year + primary author.
- Books: ISBN-13 (including the ISBN-13 equivalent of a valid ISBN-10), ISBN-10, then the same provider plus its stable identifier, then exact normalized title + year + primary author.
- Title fallback is intentionally strict. It does not use fuzzy similarity and will not merge when both records carry conflicting DOI/ISBN identifiers. If multiple records meet all three fallback fields, no merge occurs and the save response reports ambiguity.

DOIs lose a `doi:` or `doi.org`/`dx.doi.org` prefix, are trimmed and lowercased, and must match a DOI-shaped `10.<registrant>/<suffix>` value. ISBNs lose formatting characters and pass the ISBN-10 or ISBN-13 checksum before they can be used as identity keys. These rules are shared with the Resource repository, and the lookup predicates account for formatted legacy values accepted by the Phase 03 unique indexes.

## Metadata precedence

- A populated value is never replaced by null, an empty string, or an empty author list.
- Crossref ranks above OpenAlex for conflicting article metadata. For equal-ranked providers, the existing canonical value stays in place.
- For authors, an existing empty list may be filled. A longer incoming list replaces a shorter list only when the incoming provider has equal or higher precedence. Different non-empty lists are preserved as a provider disagreement.
- Other differing fields are not blended or guessed. The selected canonical value follows the precedence above, and both observations and provider identities remain available in provenance/disagreement metadata.
- The canonical record keeps its original primary `source` and `sourceIdentifier`. Additional providers and retrieval timestamps are appended to provenance. Provider-specific IDs such as OpenAlex and Google Books IDs remain in citation metadata.

These rules support reuse without turning a title resemblance or incomplete provider record into silent evidence of identity or metadata truth.
