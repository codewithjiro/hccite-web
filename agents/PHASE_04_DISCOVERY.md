# Phase 04 — Real academic discovery, normalization and duplicate prevention

**Codex task:** Read `README.md` §§1–8, 13, 18–19, 21–23, 26–29. Implement OpenAlex first, then Crossref, then Google Books, then the common Resource normalization layer. Use current official API docs for live request details.

## Build

- Implement server-only OpenAlex scholarly search with `OPENALEX_API_KEY`, relevant query/filters/pagination, minimal fields, quota/429 handling and honest open-access metadata. Expose Research Articles UI with result details, provider provenance and source link.
- Implement Crossref public/polite DOI lookup with `CROSSREF_MAILTO`, DOI normalization, title lookup where available, bibliographic enrichment and a DOI & Citation Lookup screen. An unavailable DOI verification must stay unavailable, never become verified by inference.
- Implement Google Books API-key book search, ISBN-10/13/publisher/date/author/cover/description/preview handling and Book Discovery UI. Validate links and missing fields.
- Validate provider responses with Zod or equivalent runtime checks, map them to one provider-independent Resource shape, retain source IDs/URLs and retrieval timestamps. Never use Gemini to create a Resource. Deduplicate by normalized DOI for articles, stable provider ID when DOI missing, ISBN-13/10 for books, then conservative title/year/primary-author matching with ambiguity kept visible. Use repository upsert/reuse and avoid overwriting better verified metadata with poorer fields.
- Provide loading, empty, quota, outage and retry states; keep successful user data if a provider fails. Do not trigger paid OpenAlex usage.

## Acceptance / verification

- Real article, DOI and book queries return truthful fields and provenance when credentials/network are available. Repeated lookup/save paths reuse canonical Resources.
- Fixture-based tests cover DOI variants, ISBN variants, missing authors/DOI/ISBN, conflicting provider records and quota/outage response. Live API smoke checks are listed separately; missing keys do not justify fake production results.
- Lint, typecheck and build pass.

**Handoff:** Identify normalization rules, provider error shapes and any live checks blocked by credentials.
