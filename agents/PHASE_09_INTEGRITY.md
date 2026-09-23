# Phase 09 — Research Integrity Guard

**Codex task:** Read `README.md` §§1, 5, 14, 17–19, 22–23 and 26–29. Use Crossref metadata and update relationships (including Retraction Watch data surfaced through Crossref when present), following current official response semantics.

## Build

- Implement a server-only integrity service with separate DOI verification and integrity status: `no_known_issue`, `review_required`, `corrected`, `retracted`, `unknown`. Persist evidence/source, update type/DOI/label, metadata completeness, raw metadata hash and `checkedAt` in `ResourceIntegrityCheck`. A verified DOI can still be retracted.
- Check/reuse on DOI resource open or selection, before RRL generation and during audit. Respect `INTEGRITY_CHECK_TTL_HOURS`; do not call Crossref every render. Compare changed metadata when refreshing. No DOI or Crossref outage yields unavailable/unknown as appropriate, never clean/verified by default.
- Show a clear Source Health panel with source/evidence link and last check time. Highlight retracted records prominently, surface corrections, and explain that `no_known_issue` means only no known metadata issue at check time, not verified scientific quality. Never create a generic trust score.
- Make refresh and failure paths owner-safe for private study association operations; protect against provider malformed data and transient failures. Existing resources remain available for user review when Crossref fails.

## Acceptance / verification

- Fixtures for clean, corrected, retracted, missing DOI and unavailable Crossref yield distinct correct statuses; separate DOI verification remains visible. Stale checks refresh, fresh checks reuse data; no unknown shown as green success.
- Run focused tests, lint, typecheck and build; list live checks that require network or credentials.

**Handoff:** Describe integrity service API and which statuses require RRL warning/review.
