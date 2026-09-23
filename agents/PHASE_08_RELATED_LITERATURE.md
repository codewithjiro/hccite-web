# Phase 08 — Study-driven related-literature discovery

**Codex task:** Read `README.md` §§1, 5, 8, 11–13, 18–19, 22–23 and 26–28. Use the saved Study Profile from Phase 07 and real provider services from Phase 04.

## Build

- Create study literature route. Derive editable, validated search queries from Study Profile concepts/problem/keywords and the saved `suggestedQueries`; owner can revise queries. Search OpenAlex and, when relevant, Google Books; enrich DOI records via Crossref, normalize and dedupe before presenting. Preserve provenance and current metadata completeness.
- Gemini may explain relevance using profile plus available source context, but it cannot produce search results or bibliographic facts. Clearly label AI relevance text and keep relevance score separate from research integrity. If context is title-only, the explanation must stay tentative; no invented results/findings.
- Let the owner save or associate results with the study in `StudyRelatedSource`, view reasons and select/deselect sources for later RRL. Enforce ownership across study/source associations, protect input query and IDs and make repeat searches/selections idempotent.
- Provide empty state with query edit, loading, retry, quota and partial-provider-failure states. Show integrity as unknown until Phase 09 can check it; never display unknown as healthy.

## Acceptance / verification

- Profile-derived search returns real API resources; a user can adjust query and select sources. No provider result leads to an honest empty state. User B cannot change User A's study selections.
- Tests cover query constraints, provider dedupe, owner checks and no fabricated Resource on Gemini failure; lint, typecheck and build pass.

**Handoff:** Document how a selected source is persisted and what context is available for RRL generation.
