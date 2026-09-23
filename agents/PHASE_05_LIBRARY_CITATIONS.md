# Phase 05 — Citations and personal source library

**Codex task:** Read `README.md` §§1–2, 5, 8, 16, 18–19, 22–23 and 26–28. Build on normalized Resources from Phase 04.

## Build

- Convert verified normalized metadata to Citation.js/CSL input. Produce deterministic APA, MLA and Chicago reference previews for articles and books. Distinguish missing metadata and formatting errors; do not ask Gemini to write authoritative references. Keep formatting server-side or in a safe shared module without secrets.
- Make Save/Unsave Source work in search/lookup/book screens. Implement user-owned saved-source listing, reading status, notes, tags, collections, collection membership and CRUD screens/actions. Reuse one canonical Resource when multiple users save it; isolate each user's private state.
- Show duplicate indicators and support add-to-collection from search results. Ensure save operations are idempotent, validate text and IDs, and preserve collection/tag uniqueness per user.
- Add copy citation control only when a citation was successfully produced; permit review of incomplete bibliographic data. Do not silently create missing author, year or DOI values.

## Acceptance / verification

- APA/MLA/Chicago produce formatted output from known metadata; an incomplete record is presented honestly. Saving twice creates one saved record; another user's notes/tags/collections cannot be read or changed.
- Focused tests cover citation conversion, duplicate saves and cross-user access. Run lint, typecheck and build; do one manual article and book flow if live keys exist.

**Handoff:** Describe saved-source ownership and citation service API for RRL and audit phases.
