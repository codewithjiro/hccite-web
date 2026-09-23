# HCCite: Codex implementation phases

Use these files **in order** in the HCCite Git repository. Keep the original `README.md` in the repository: it is the authoritative product specification. Each phase is a task brief, not a replacement for the README. Give Codex the current phase file and ask it to implement that phase completely before proceeding. You can paste: **“Read README.md and PHASE_XX_....md thoroughly. Implement this phase in the repository, run its checks, and report the handoff. Do not implement later phases.”**

| Order | File | Working result |
| --- | --- | --- |
| 01 | `PHASE_01_FOUNDATION.md` | Running Next.js/T3 shell and shared UI |
| 02 | `PHASE_02_AUTH.md` | Clerk sign-in and protected user routes |
| 03 | `PHASE_03_DATABASE.md` | PostgreSQL/Drizzle domain schema and ownership-aware access |
| 04 | `PHASE_04_DISCOVERY.md` | OpenAlex, Crossref and Google Books search; normalized resources |
| 05 | `PHASE_05_LIBRARY_CITATIONS.md` | Citation styles, saved sources, collections, notes and tags |
| 06 | `PHASE_06_STUDY_UPLOAD.md` | Validated PDF/DOCX uploads and My Studies lifecycle |
| 07 | `PHASE_07_STUDY_ANALYSIS.md` | Document extraction and persistent Gemini Study Profile |
| 08 | `PHASE_08_RELATED_LITERATURE.md` | Profile-driven real-source discovery and selection |
| 09 | `PHASE_09_INTEGRITY.md` | DOI verification and correction/retraction evidence |
| 10 | `PHASE_10_RRL_GENERATION.md` | Selected-source, source-grounded editable RRL |
| 11 | `PHASE_11_TRACE_AUDIT.md` | Citation traceability, bibliography audit and gated export |
| 12 | `PHASE_12_DASHBOARD_QA.md` | Dashboard and full acceptance pass |

## Rules for every Codex run

1. Inspect the actual repository, existing changes and `README.md` before coding. Reuse what already works; never overwrite unrelated work. If starting from scratch, scaffold in the existing repository after inspecting it. Commit only when requested.
2. Implement the current phase as real end-to-end functionality. Avoid mock successes, fabricated academic records, silent fallback to fake data, hardcoded demo credentials or UI controls that do nothing. If an external account/key is absent, finish code and tests with safe fixtures, list the exact missing configuration, and leave live verification explicitly pending.
3. Preserve the approved stack: Next.js App Router/Create T3 App, TypeScript, Tailwind, shadcn/ui, Clerk, PostgreSQL/Drizzle, Zod, Gemini, UploadThing, OpenAlex, Crossref, Google Books, Citation.js/CSL, pnpm. No paid-only features, new providers, tRPC, NextAuth, vector database, administrator/faculty role or extra infrastructure without explicit scope change.
4. Validate untrusted inputs and provider responses. Keep keys server-side; enforce Clerk authentication **and resource ownership** for every private read/write. Source metadata comes from academic APIs; Gemini never becomes the source of bibliographic truth. Show unknown/unavailable states honestly.
5. Use current official service docs for details that may have changed, including the configured `gemini-3.8-flash` model and free-plan quotas. If the documented model or a stated free-tier limit is unavailable, report the exact discrepancy and make the smallest explicit configuration adjustment; do not silently switch to paid service.
6. Run focused meaningful checks plus the project's lint, typecheck and build as available. At the end of each phase, report changed files, completed behavior, tests/results, any blocking missing credentials and a short manual verification path. Fix failures caused by the phase before handing off.

## Setup the owner must supply

The app needs free-tier Clerk, PostgreSQL, OpenAlex, Crossref contact email, Google Books, UploadThing and Gemini configuration as the relevant phases arrive. Use `.env.example`; put real secrets in ignored local environment files, never commit them. The app must display the non-confidential/demo-only file warning before any study upload because UploadThing free-plan files are URL-accessible and Gemini free-tier handling has privacy implications in the source README.

## Completion gate

After Phase 12, compare the implementation against **every item** in README §28, with a pass/fail/blocked-by-credential result and evidence for each. A working screen alone is not a passing result.
