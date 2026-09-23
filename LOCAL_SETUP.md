# HCCite local setup — Phase 02

The product specification is `README.md`. The current implementation includes the Phase 01 interface and Phase 02 Clerk authentication. Research and database features are later phases.

## Run

1. Install Node.js 20 or newer and pnpm, then run `pnpm install`.
2. Create a free Clerk application in the [Clerk Dashboard](https://dashboard.clerk.com/). Enable email sign-up and sign-in in its settings. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` from the same Clerk instance. Leave the Clerk route and fallback URL values as shown. Set these before starting development or building for production.
3. Run `pnpm dev` and open `http://localhost:3000`.

Keep `.env.local` and all secrets untracked. If either Clerk key is missing, the public landing and auth setup message remain accessible; every workspace and account route stays closed.

## Authentication routes

`/` is public. `/sign-in` and `/sign-up` are public Clerk-hosting routes with optional catch-all segments for multi-step flows. `/profile` and all workspace pages are private. A signed-out request to a private page redirects to `/sign-in`, with its destination preserved for return after sign-in. Private `/api` paths deny unauthenticated requests with `401` when Clerk is configured, or `503` when its keys are absent.

The workspace includes `/dashboard`, `/research-articles`, `/doi-lookup`, `/books`, `/ai-analyzer`, `/studies`, `/collections`, and study-specific `/studies/[studyId]/analysis`, `/literature`, and `/rrl`. Those research pages still explain their later-phase status. The account button opens Clerk profile and sign-out actions; `/profile` provides the full profile screen.

## Server authorization handoff

In every private Server Component, Server Action, or route handler, call `await requireUserId()` from `src/server/auth.ts` immediately before reading or changing user data. Never take an owner ID from browser input. For a user-owned row, load it and call `requireOwnedRecord(row, ownerId)` before returning or mutating it. The helper returns the row to its owner and returns a 404 for absent or foreign rows. Phase 03's `UserProfile` will have an internal ID: resolve it from the authenticated Clerk ID (`clerkUserId`) first and use that internal ID as `ownerId` when checking records whose `userId` references `UserProfile.id`. Scope list queries by that same internal ID at the database query level.

`src/middleware.ts` provides a request boundary for all current workspace paths and `/api`; the workspace server layout repeats the session check. New data access must use the server helpers near the query or mutation because a layout alone does not authorize a record or rerun on every client navigation.

## Checks

Run `pnpm test:auth`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`. No database is needed for Phase 02. Phase 03 adds PostgreSQL schema and repositories. Other credentials listed in `.env.example` are for later phases.
