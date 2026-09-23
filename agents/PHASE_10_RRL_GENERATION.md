# Phase 10 — Source-grounded AI-assisted RRL

**Codex task:** Read `README.md` §§1, 11, 14–18, 22–24 and 26–28. Generate an editable RRL from a Study Profile and **only sources the study owner explicitly selected**.

## Build

- Build the RRL workspace and generation action. Recheck owner and selected-source IDs server-side. Build an immutable allow-list snapshot in `RRLDraftSource` at generation time, with stable HCCite citation keys. Send Gemini only the relevant profile, selected metadata, available abstracts/permitted context, citation keys and chosen style. Do not include other saved/discovered sources or repeatedly send the full study.
- Require structured output with thematic sections and citation keys. Validate every referenced key against the allow-list **before persistence**; reject or safely retry unmapped output. Do not accept a plausible-looking prose reference or DOI from Gemini as an authoritative source. With title-only context, restrict claims accordingly and label limits in the result. Summarize by themes, not a list of unrelated source blurbs.
- Warn prominently about selected retracted sources and require deliberate user review before using them; unknown integrity remains visibly unknown. Bounded 429 retry must not produce duplicate drafts. Preserve an editable draft and record model, version and content hash; regeneration is a new version/record according to the chosen schema. Changes invalidate any old audit (Phase 11).
- Citations/bibliography are formatted from metadata with Citation.js/CSL, never directly trusted from Gemini. Make loading, insufficiency, error, retry and save-edit states clear.

## Acceptance / verification

- With an allow-list of two known sources, output cannot persist a third key; cross-user and deselected IDs fail authorization. Edits save as new draft version/hash; repeated retry does not duplicate draft.
- Tests cover selected-source validation, forged IDs, unknown citation keys, title-only context and rate-limit retries. Run lint, typecheck and build; live Gemini check only when configured.

**Handoff:** Specify the exact stored draft format, citation token convention and version/hash behavior for Phase 11.
