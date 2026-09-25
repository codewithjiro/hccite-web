# Phase 12 acceptance evidence

Verified on 2026-09-25 with Node.js 24.20.0 and pnpm 11.19.0.

## README §28 matrix

| # | Requirement | Status | Evidence / check | Remaining blocker or reproduction |
|---:|---|---|---|---|
| 1 | Users can sign up/sign in and protected routes work | PASS | `pnpm test:auth`; authenticated Clerk session opened all protected workspace routes; signed-out boundary and nested paths tested | None |
| 2 | User-owned data cannot be read or mutated by another user | PASS | `pnpm test:db`, `pnpm test:literature`, `pnpm test:rrl-audit`, and `pnpm test:dashboard` exercise foreign studies, collections, selections, drafts, citation details, audits, exports, counts, and recent activity | None |
| 3 | OpenAlex article search works | PASS | Controlled Phase 08 live smoke returned 20 real OpenAlex results with no OpenAlex warning; fixture quota/outage tests also pass | Requires `OPENALEX_API_KEY` for reproduction |
| 4 | Crossref DOI lookup works | PASS | Controlled live lookup of DOI `10.1038/nphys1170`; Phase 05 live Crossref discovery/save flow; discovery and integrity suites | Requires `CROSSREF_MAILTO` and network |
| 5 | Google Books discovery works | PASS | Phase 05 and Phase 08 controlled live searches returned real book metadata; discovery error/empty fixtures pass | Requires `GOOGLE_BOOKS_API_KEY` and network |
| 6 | Resources are normalized and duplicates are handled | PASS | `pnpm test:discovery` and `pnpm test:db` cover DOI/ISBN/provider identity, concurrent equivalent ISBNs, ambiguity, and metadata merge | None |
| 7 | APA/MLA/Chicago citation generation works | PASS | `pnpm test:citation`; Phase 05 live article and book flow generated all three styles | None |
| 8 | PDF/DOCX study upload works within configured free-tier limit | PASS | `pnpm test:studies` validates PDF/DOCX signatures, MIME/extension, unsupported and oversize cases; database contains ready PDF and DOCX profiles; real synthetic UploadThing upload/delete passed | Browser upload requires `UPLOADTHING_TOKEN`; use only non-confidential files |
| 9 | Deleting a Study removes its stored file and related records | PASS | `pnpm test:db` and `pnpm test:studies` cover storage-first deletion, cascades, already-absent object, and retryable partial failure; real synthetic UploadThing delete passed | None |
| 10 | Gemini creates a Zod-validated Study Profile | PASS | `pnpm test:analysis`; controlled live synthetic DOCX profile succeeded with two suggested queries; persisted ready PDF/DOCX profiles exist | Live provider can intermittently return HTTP 503 |
| 11 | Long documents are not unnecessarily reprocessed | PASS | `pnpm test:analysis` verifies ready-profile reuse, large-PDF temporary file cleanup, and section-aware fallback | None |
| 12 | Related-literature searches use Study Profile concepts | PASS | `pnpm test:literature`; controlled Phase 08 live smoke used a ready profile and returned real sources | None |
| 13 | Retrieved results preserve provider provenance | PASS | Discovery normalization tests and live Phase 08 Crossref-enrichment evidence | None |
| 14 | Research Integrity Guard surfaces corrections/retractions when metadata provides them | PASS | `pnpm test:integrity` clean/corrected/retracted/review fixtures and Crossref update lookup | Live result depends on provider metadata |
| 15 | Integrity failures/unavailable checks do not display as success | PASS | Integrity outage/missing DOI tests preserve `unknown` or adverse evidence; dark/light manual review | None |
| 16 | RRL generation uses only user-selected sources | PASS | `pnpm test:rrl` allow-list, forged/deselected ID, and unknown-key checks; DB repository reauthorizes selections | Live Gemini RRL smoke was BLOCKED by malformed HTTP-200 output, then HTTP 503; no invalid draft was persisted |
| 17 | Generated citations map back to Resources | PASS | `pnpm test:rrl-audit` validates repeated occurrence links and exact citation detail mapping | None |
| 18 | Editing/regenerating a draft invalidates its old audit | PASS | `pnpm test:rrl-audit` verifies new version/hash, stale gate, re-audit, and current export | None |
| 19 | Bibliography Audit detects unmapped/duplicate/unselected/problematic references | PASS | `pnpm test:rrl-audit` fail-closed parser and DB integration | None |
| 20 | External API failures and quota limits produce recoverable states | PASS | Discovery, analysis, literature, integrity, and RRL suites cover 429/outage/malformed/timeout behavior, bounded retries, preservation, and no false verification | Live Gemini availability remains externally variable |
| 21 | App warns that the free-tier build is for non-confidential files | PASS | Manual mobile studies check shows the warning before upload; upload component and setup docs preserve exact policy | None |
| 22 | Desktop and mobile layouts remain usable | PASS | Browser matrix at 1440/1024/768/375 across dashboard, research, DOI, books, collections, and studies: zero horizontal overflow and zero off-screen controls; light/dark checked | Nested RRL UI is additionally covered by component/build tests; no owned study was present in the manual Clerk session |

## Definitive command results

| Command | Result |
|---|---|
| `pnpm test:auth` | PASS — 5/5 |
| `pnpm test:db` | PASS — 1/1 broad integration suite (initial remote `ECONNRESET` was retried successfully) |
| `pnpm test:discovery` | PASS — 12/12 |
| `pnpm test:citation` | PASS — 10/10 |
| `pnpm test:studies` | PASS — 5/5 |
| `pnpm test:analysis` | PASS — 8/8 across unit and DB processes |
| `pnpm test:literature` | PASS — 5/5 |
| `pnpm test:integrity` | PASS — 6/6 |
| `pnpm test:rrl` | PASS — 3/3 |
| `pnpm test:rrl-audit` | PASS — 6/6 across unit and DB processes |
| `pnpm test:dashboard` | PASS — 1/1 owner-scoped integration suite |
| `pnpm lint` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS — 18 static/dynamic routes built |
| `git diff --check` | PASS (only platform line-ending notices) |
| `pnpm db:migrate` | PASS — migrations already/currently applied |

## Live service status

| Service | Status | Evidence |
|---|---|---|
| OpenAlex | PASS | 20 real results in controlled profile-driven search; no warning |
| Crossref | PASS | Real DOI lookup, title discovery/save, and enrichment |
| Google Books | PASS | Real book discovery/save and profile-driven book search |
| UploadThing | PASS | Auth route tests plus real synthetic PDF storage upload and deletion |
| Gemini Study Profile | PASS | Live synthetic DOCX profile returned valid structured data |
| Gemini RRL | BLOCKED | First live response was HTTP 200 but invalid structured RRL; later provider request returned HTTP 503. Fixture and DB tests prove bounded retry, allow-list validation, and no invalid persistence |

No paid usage was enabled and no live provider success was mocked.
