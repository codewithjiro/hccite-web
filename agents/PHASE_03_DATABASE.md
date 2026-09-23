# Phase 03 — PostgreSQL, Drizzle and ownership-aware repositories

**Codex task:** Read `README.md` §§8, 14–18, 21–23 and 26–28; inspect Phases 01–02 implementation. Implement the persistence contracts needed for the rest of HCCite, even if some tables are populated in later phases.

## Build

- Configure PostgreSQL + Drizzle schema, migrations and database connection. Implement README §18 entities: `UserProfile`, `Resource`, `SavedResource`, `Collection`, `CollectionResource`, `Tag`, `ResourceTag`, `Study`, `StudyAnalysis`, `StudySection`, `StudyRelatedSource`, `ResourceIntegrityCheck`, `RRLDraft`, `RRLDraftSource`, `RRLCitationLink`, `RRLAudit`. Adjust keys/relations/columns as needed while preserving responsibilities.
- Store normalized metadata/provenance including provider, source identifier, retrieval time, DOI/ISBN, canonical URL and citation-ready author/date fields. Model DOI verification separately from integrity state. Preserve draft version/content hash and audit linkage. Enforce important uniqueness and foreign keys: normalized DOI/ISBN where appropriate, provider identifier, owner/resource saved pair, membership pairs, analysis per study/version, and citation keys scoped to a draft. Identity fallback by title/year/author must be conservative and reviewable, never a broad unique collision.
- Add timestamp/status constraints, proper cascade behavior for owned relational records, and indexes for owner queries. Design study file deletion as an explicit service operation because DB cascade cannot remove UploadThing objects.
- Implement consistent repository methods. Each user-owned query/mutation derives user identity server-side and filters by owner; nested records resolve through their parent owner. Canonical public `Resource` metadata can be shared, while `SavedResource`, notes, collections, studies, selections, drafts and audits are private.
- Create a migration/connection setup guide and a small seed strategy limited to clearly labelled development fixtures; no AI-generated references presented as real.

## Acceptance / verification

- Migrations apply cleanly to an empty local DB and schema/types compile; rollback/rebuild procedure is documented.
- Focused tests demonstrate that a second user cannot read or mutate a first user's nested study/collection/draft records. Unique keys and cascades behave as intended.
- Lint, typecheck and build pass. If `DATABASE_URL` is absent, report migration/live DB checks as pending, not passed.

**Handoff:** Record key schema decisions and how subsequent phases should call the repositories.
