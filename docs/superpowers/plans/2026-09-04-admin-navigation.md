# Unified administrator navigation implementation plan

> Approved by the user on 2026-09-04. Execute inline with writing-plans, TDD and verification-before-completion. Preserve existing working-tree changes; no commits, remote settings changes or database migrations are required.

**Goal:** Add an administrator-only article-management navigation link and a five-click pixel-octopus login entry, backed by one verified session state across the site.

**Architecture:** Keep `/admin/login` and `/admin/articles`. Wrap the app in `AdminAuthProvider`; derive admin status from the existing verified Supabase `getUser()` check. Use custom sessionStorage with an in-memory fallback to retain sessions on tab reload. Navigation and comment controls consume the same provider, while repository/server/RLS mutation checks remain authoritative. Accept only known same-site return routes.

**Tech stack:** React context, TypeScript, existing Supabase JS client, local SVG artwork, Node tests + jsdom + Vite SSR test loader.

## Approved interaction

- Reader logo: everyday pixel octopus. Five clicks within a rolling 2-second window navigate to `/admin/login?next=<current path>`; fewer/slower clicks do not navigate. Route changes reset the sequence. Keyboard activation uses the same button.
- Brand text remains a home link. Desktop and mobile administrator navigation shows `文章管理` linking to `/admin/articles`.
- Administrator logo: pixel octopus with a small gold crown, distinct beyond color. A click offers confirmation before local-session logout; loading/error state is accessible.
- Session checking hides privileged controls. Successful login returns to the originating page. Same-tab reload retains the login; explicit logout removes it. Storage failures degrade to memory, not localStorage.
- Unauthorized direct navigation to `/admin/articles` remains denied. Non-admin authenticated accounts get a clear access message and may sign out to switch accounts.

## Steps

- [x] Add helper tests for five-click timing, safe return paths, tab storage reload/fallback, and role subscription races (sign-out invalidates pending admin checks).
- [x] Add repository tests verifying custom persistence and local logout error propagation. Add DOM tests for ordinary/admin/checking navigation, desktop/mobile links, login redirect and rejected logout.
- [x] Observe new tests fail before implementing helpers in `src/app/auth/adminSession.ts`.
- [x] Implement `src/app/context/AdminAuthContext.tsx`; configure repository storage and proper local logout errors; wire provider in `App.tsx`.
- [x] Update `Navbar.tsx` and `OctopusAvatar.tsx` for an accessible separate icon button, crown, five-click navigation and confirmed sign-out. Keep the existing typography, light/dark styles and mobile layout.
- [x] Switch `AdminLogin.tsx`, `AdminArticles.tsx` and `Post.tsx` to shared role state; sanitize `next` and use a fixed login callback carrying the validated return path.
- [x] Run targeted tests, full suite, build and whitespace checks. Inspect the navbar in a local browser if available, without sending emails or mutating real data. Document any required Supabase redirect allowlist entry and verification limits.

## Security checks

No authority comes from the icon, URL, click sequence or browser storage. Supabase verifies user identity and database/RLS checks still protect writes. Auth callbacks defer API calls to avoid session-lock deadlocks. Async role requests cannot restore administrator UI after logout/unmount. Callback return paths reject external/protocol-relative URLs, backslashes, control characters, unknown routes and login loops.

References: https://supabase.com/docs/reference/javascript/auth , https://supabase.com/docs/reference/javascript/auth-signout , https://supabase.com/docs/reference/javascript/auth-onauthstatechange

## Verification and handoff — 2026-09-04

- TDD: the initial 13 new tests failed before implementation; the final targeted suite passes 16/16.
- `node --import tsx --test tests/**/*.test.ts`: 71 passed, 0 failed. The Node importer avoids the sandbox IPC restriction of the `tsx` CLI.
- `npm run build`: passed, with the existing large-bundle warning. `git diff --check`: passed.
- Strict TypeScript check of the new auth helpers/context and changed navbar/login/management pages: passed. Including `Post.tsx` also checks `MarkdownRenderer.tsx` and encounters existing missing declarations for `react-syntax-highlighter` and its Prism styles; the broader strict check is not clean.
- Local browser: verified desktop and 390px mobile layout, guest-only navigation, and actual five-click navigation to `/admin/login?next=%2F`. Admin display, redirects, authorization gates and logout flows are covered by DOM tests, not a real administrator login.
- No real auth emails were sent, no remote configuration was changed, and no database migrations were executed. Supabase must allow the `/admin/login` callback with its `next` query for each deployed origin; configuration examples are in the root README.
- This navigation change requires no new migration. Administrator comment deletion still depends on the previously added migration `005_admin_comment_deletion.sql`.
