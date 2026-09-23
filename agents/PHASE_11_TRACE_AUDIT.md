# Phase 11 — Citation traceability, bibliography audit and export gate

**Codex task:** Read `README.md` §§1, 5, 15–18, 22–23 and 26–28, plus Phase 10's actual draft format. Implement traceable citations and an audit of the **current** editable draft.

## Build

- Parse/render stable citation keys in the draft and persist `RRLCitationLink` to the exact stored Resource, draft and section/context. Make citations clickable to source details: title, authors, year, DOI/ISBN, provider, available abstract/context, integrity status, deterministic formatted reference, relevance/association reason and latest check time. Reject orphan keys rather than silently treating them as plain references.
- Run Bibliography Audit on exact `draftVersion` and `draftContentHash`. Check mapping for every citation, unselected source references, duplicates, DOI verification where applicable, missing metadata, correction/retraction/unknown integrity, and Citation.js/CSL formatting. Save counts and specific actionable issues. A cited subset may be smaller than the selected set: report **selected sources** and **mapped citations** separately; do not force every selected source into prose.
- Handle user-edited prose: either enforce structured citation tokens and reject unparseable citation/reference text before passing audit, or provide a clear manual-review flag. Never declare the audit passed if new untraceable citations were typed into free-form content. This is a fail-closed requirement for the acceptance criterion.
- On edit, change of selected sources, style change affecting output, or regeneration, make the old audit stale. Recompute hash from the persisted exact content and check it again at the copy/export action, not only when displaying a button. Allow draft editing/saving, but gate **final copy/export** on a current passing audit; explain review-required issues and retry/reaudit paths. Exports must use the same audited content/version.

## Acceptance / verification

- A mapped citation opens its Resource; an invented/unselected/duplicate or retracted reference yields the appropriate issue. Modifying draft after a passing audit prevents final copy/export until it is audited again. A second user cannot read links or audit by URL.
- Tests cover hash/version invalidation, citation parser, unknown manual reference, fresh vs stale export and owner checks. Run lint, typecheck and build.

**Handoff:** Explain the audit statuses, passing policy and how the export action verifies the current draft.
