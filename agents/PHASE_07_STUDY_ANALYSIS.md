# Phase 07 — Document processing and persistent Study Profile

**Codex task:** Read `README.md` §§4, 9–12, 18, 22–24 and 26–29. Add server-side PDF/DOCX preparation and Gemini-based initial analysis of owner-uploaded, non-confidential studies.

## Build

- Process PDF with Gemini document input; use Gemini Files API when helpful for a large PDF as **temporary** AI handling, never as the persistent copy. For DOCX, extract paragraphs/headings/section order server-side; reject corrupt or unprocessable input safely. Capture useful page/section references when possible; do not pretend DOCX page numbers exist if not derivable.
- Produce the README §11 Study Profile: title, summary, problem, objectives, keywords, methodology, concepts, optional population/findings/conclusion, suggested queries and optional page ranges. Validate structured model output using Zod before saving a versioned `StudyAnalysis`. Clearly label AI-generated fields and allow owner review. Keep `StudySection` for targeted follow-up, preserving section order and useful text references.
- Implement state transitions uploaded → processing → ready or failed; persist a safe processing error and allow owner-only retry. Bound Gemini 429 retries/backoff (respect Retry-After if provided); prevent concurrent runs on the same study; make retries idempotent. If whole-document analysis fails/is too expensive, try section-aware extraction/analysis for the required portions; arbitrary fixed-page chunks only as last resort.
- Reuse the stored profile for later search/relevance/RRL planning. Do not resend the full document for each request. Gemini keys remain server-side; free-tier model defaults to README's configured `gemini-3.8-flash` after checking actual availability in official docs. Do not silently use a paid model.

## Acceptance / verification

- An uploaded PDF and DOCX each reach a valid saved profile in live conditions; invalid model JSON becomes retryable failure, not a ready profile. Retry cannot create duplicate analyses, and rate limiting preserves the original study/file.
- Tests cover schema validation, status/retry/ownership and document extraction on non-confidential fixtures; lint, typecheck and build pass. Explicitly label checks blocked by a missing Gemini key.

**Handoff:** Describe profile schema/version, section fallback and how later phases retrieve the saved profile.
