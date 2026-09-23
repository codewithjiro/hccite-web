# Phase 12 — Dashboard, reliability and full acceptance pass

**Codex task:** Read the entire `README.md`, especially §§19, 22–29, and inspect every completed phase in the actual repository. Finish the dashboard and close cross-phase gaps without adding new product scope.

## Build

- Dashboard: owner-only counts for My Studies, saved sources, collections and citations generated; recent studies/resources and working quick actions. Derive counts from real DB records, not placeholders. Keep page usable with no data.
- Verify the whole flow: signup → search article/book/DOI → normalize/save/cite/collect → upload PDF and DOCX → Study Profile → related search → select sources → integrity review → RRL → traceable citations → audit → copy/export → delete study. Ensure every screen has loading, empty, error, retry and stale states where applicable, and responsive layouts.
- Fix cross-phase correctness: all user-owned read/write paths require authentication and ownership; keys stay server-only; uploaded files are non-confidential/demo with the warning; provider failures preserve data; Gemini 429/OpenAlex quota cannot activate paid usage; Crossref outage never verifies; unknown integrity never looks safe; retries avoid duplicate Resource/StudyAnalysis/RRLDraft/audit records; study deletion removes stored file plus descendants.
- Run meaningful automated checks and manual walkthrough at desktop/mobile widths. Include adversarial cases: User B opening User A's nested URLs; oversized/spoofed files; missing DOI; inconsistent provider metadata; retracted record; unknown model citation; edit after audit; provider outage and quota. Repair failures introduced by this project work.
- Compare **each bullet of README §28** to an observed check, test result or explicitly blocked live verification. Update local developer setup instructions for the final state.

## Acceptance / verification

- Lint, typecheck, build and focused/integration tests pass; live external-service flows pass where configured. No mock success is counted as a live pass.
- Provide a compact README §28 pass/fail/blocked table with evidence, remaining blockers and exact setup or reproduction steps. Declare the school-project build complete only if all required acceptance criteria are satisfied.

**Handoff:** Give the user start commands, environment checklist, demo walkthrough and any remaining limitations actually observed.
