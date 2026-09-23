# Phase 02 — Clerk authentication and authorization boundary

**Codex task:** Read `README.md` §§1, 3–4, 19, 21–23, 26–28 and Phase 01 handoff. Implement email sign-up, sign-in, session handling, profile and logout using Clerk free/Hobby features. Inspect the existing repository first.

## Build

- Configure Clerk App Router middleware and server-side session helpers according to current official docs. Protect all user areas, including dashboard, studies, collections and nested study pages; leave landing and auth paths public.
- Show sign-in/sign-up and user profile/logout in a usable UI. Redirect signed-out users to sign-in, then back to the intended route where appropriate. Handle loading and auth errors.
- Create one reusable server helper that requires a Clerk user ID and one pattern for checking ownership of user-owned DB records. The schema/repositories are implemented next phase; wire the helper into all private routes/actions as they arrive. A client-side route guard is insufficient.
- Do not trust a `userId` supplied by a browser or use merely knowing a UUID as authorization. Keep `CLERK_SECRET_KEY` server-only.

## Acceptance / verification

- Signed-out visits to private pages/actions are denied; signed-in user can open their account and log out; direct nested URL access is protected.
- Add meaningful authorization checks around any existing private API and tests for the auth helper where practical. Check lint, typecheck and build.
- If Clerk keys are absent, finish integration, give setup steps, and explicitly mark live sign-in testing pending rather than claiming success.

**Handoff:** Explain auth route conventions and exactly how future phases call the server ownership helper.
