# Phase 01 — Application foundation and shared UI

**Codex task:** Read the repository and full `README.md`, especially §§1–7, 19–21 and 26–29. Implement only this phase. If the repository is empty, create the Next.js App Router + TypeScript project using Create T3 App with pnpm and only approved options; do not enable tRPC or NextAuth. If already scaffolded, adapt it without discarding existing code. Make the basic site run locally.

## Build

- Establish Tailwind, shadcn/ui and Lucide React; use a consistent responsive layout, header/sidebar/navigation, accessible controls and route shell. Add the public landing page with HCCite's purpose, feature explanation and login/signup entry points (auth becomes live in Phase 02).
- Use the supplied `/assets/app_logo.jpg` as the HCCite app logo and `/assets/hero.png` as the landing-page hero image. Inspect the actual repository assets and preserve their proportions; do not replace them with generated placeholders. For a Next.js app, expose them through `public/assets/` (or the existing equivalent) so `/assets/app_logo.jpg` and `/assets/hero.png` resolve in the browser. Use `next/image` where appropriate, meaningful alt text, suitable image sizing and a layout that remains readable if an image fails to load.
- Implement working light and dark modes throughout the app shell and landing page. Follow system preference initially, offer a visible theme toggle, persist the user's choice, avoid an initial theme flash, and check colors, text, icons, focus states and image surroundings for readable contrast in both modes.
- Design for phone, tablet, laptop and desktop widths. Navigation must adapt to narrow screens; hero image and text must reflow without cropping essential content, overlap, horizontal scrolling or tiny controls. Preserve keyboard access and usable touch targets.
- Lay out the planned routes: dashboard, research articles, DOI/citation lookup, books, AI analyzer, studies, collections and study-specific analysis/literature/RRL. Routes awaiting future phases should be honest explanatory placeholders, never fake results or functional-looking buttons that imply features exist.
- Separate `src/app`, `src/components`, `src/server/services`, `src/server/repositories`, `src/lib`, and `src/env.ts` as appropriate. Mark future provider modules server-only when introduced. Keep all API credentials in server environment variables.
- Create a complete `.env.example` based on README §21, without real keys. Set up env validation so missing phase-later credentials are reported clearly when their feature runs instead of breaking unrelated local development; required startup fields should be truly required for the currently implemented app.
- Add package scripts for dev, lint, typecheck and build. Document concise local setup steps, including pnpm, database and the later external-service keys.

## Acceptance / verification

- App starts; `/assets/app_logo.jpg` and `/assets/hero.png` load and appear in the intended logo/hero positions. Unfinished routes identify themselves correctly.
- Manually check landing page and app shell in both light and dark modes at representative phone, tablet, laptop and desktop widths. Toggle and reload to confirm the saved theme; check system preference for a first visit. Confirm navigation, text, buttons and images remain legible and usable without horizontal overflow.
- `pnpm lint`, `pnpm typecheck` and `pnpm build` pass, or Codex reports a real external setup blocker with evidence.
- No secret appears in client code, git-tracked env files or browser payloads. No excluded framework/provider was added.

**Handoff:** List routes and scripts; state any required local prerequisites. Phase 02 adds real authentication.
