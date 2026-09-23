# Phase 06 — UploadThing and My Studies lifecycle

**Codex task:** Read `README.md` §§4, 9–10, 18–19, 21–23 and 26–28. Add persistent PDF/DOCX study uploads and owner-only study management; Gemini analysis follows in Phase 07.

## Build

- Configure the authenticated UploadThing App Router route on the free plan with an explicit max file size from `MAX_STUDY_FILE_MB` (README recommends 50 MB). Enforce size in UI and server route; allow only PDF/DOCX with extension, MIME and content-signature checks appropriate to each format. Reject invalid or oversized files with a clear message before AI work. Associate upload to the authenticated owner and persist storage key, URL, filename, type, status and timestamps.
- Display **before upload**: “Do not upload confidential, sensitive, or unpublished research documents. Use this build only with non-confidential/demo study files.” Treat UploadThing free-plan files as public by URL. Do not imply that Clerk makes the file URL private.
- Implement My Studies list/detail, `uploaded/processing/ready/failed` status presentation and owner-checked delete. Deletion must remove the UploadThing object and associated records/analysis/sections/related sources/drafts/links/audits. Handle partial deletion failures explicitly and make retries safe; do not silently leave an orphaned public file. Avoid duplicate study records on upload retries.
- Access to private study metadata must require owner validation even though persistent free-tier file URLs themselves are public. Distinguish those privacy properties in the UI.

## Acceptance / verification

- PDF/DOCX upload, list, detail and delete work for the owner; second user is denied, including direct IDs and route handlers. Invalid MIME/extension/signature and over-limit files are rejected. File object disappears on successful deletion.
- Tests cover validation, ownership and deletion failure/retry; run lint, typecheck and build. If UploadThing token is unavailable, mark live upload/delete pending and explain how to verify.

**Handoff:** Explain storage-key lifecycle and the processing/retry entry point for Phase 07.
