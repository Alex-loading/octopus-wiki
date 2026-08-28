# Feishu Live Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task by task.

**Goal:** Replace the browser-to-local `feishu2md` conversion path with a lightweight Vercel Serverless path that previews, fetches, caches, snapshots, and renders Feishu documents without exposing Feishu credentials to the browser.

**Architecture:** The browser stores only a Feishu document URL and calls same-origin `/api` endpoints. Serverless functions authenticate with Feishu, resolve Wiki links, fetch Docx blocks, convert them to Markdown, sign media URLs, and persist successful content as a Supabase snapshot. Public reads prefer live content with short CDN caching and fall back to the database snapshot.

**Tech Stack:** React 19, TypeScript, Vite, Vercel Node.js Functions, Supabase, Feishu OpenAPI, `feishu-docx@0.7.0`, Node test runner via `tsx`.

---

## Task 1: Establish the test harness and request primitives

**Files:**

- Modify: `package.json`
- Create: `tests/api/feishu-url.test.ts`
- Create: `tests/api/media-signature.test.ts`
- Create: `api/_lib/feishu.ts`
- Create: `api/_lib/media-signature.ts`

- [ ] Add `test` and focused API test scripts using `tsx --test`.
- [ ] Write failing tests for accepted Wiki/Docx URLs, query stripping, hostile lookalike hosts, unsupported paths, and malformed tokens.
- [ ] Run the URL tests and confirm they fail because the parser does not exist.
- [ ] Implement the smallest URL parser and typed Feishu error model that make those tests pass.
- [ ] Write failing tests for deterministic HMAC signatures, tampering, unsupported media types, and constant-time verification behavior.
- [ ] Run the signature tests and confirm failure.
- [ ] Implement signed media URL creation and verification, then rerun both test files.

## Task 2: Implement Feishu authentication, Wiki resolution, and block pagination

**Files:**

- Modify: `api/_lib/feishu.ts`
- Create: `tests/api/feishu-client.test.ts`

- [ ] Write failing tests using an injected `fetch` implementation for tenant-token caching, Feishu error mapping, Wiki-to-Docx resolution, direct Docx URLs, document metadata, and multi-page block reads.
- [ ] Verify the tests fail before adding network behavior.
- [ ] Implement a fetch-based `FeishuClient` with an in-memory token cache and explicit environment validation.
- [ ] Implement Wiki node resolution and reject non-Docx targets.
- [ ] Implement document metadata and paginated block retrieval with a page-size cap.
- [ ] Implement Drive media download methods for images/files/boards.
- [ ] Rerun the focused tests and confirm all Feishu client cases pass without real network access.

## Task 3: Convert Docx blocks to Markdown and proxy media

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `api/_lib/markdown.ts`
- Create: `tests/api/markdown.test.ts`

- [ ] Install and pin `feishu-docx@0.7.0`.
- [ ] Inspect the installed renderer contract and create a minimal representative Docx fixture.
- [ ] Write a failing conversion test covering headings, paragraphs, formatting, and media-token rewriting.
- [ ] Implement `MarkdownRenderer` integration and rewrite renderer file tokens to signed same-origin media URLs.
- [ ] Add a stable placeholder for blocks the renderer cannot represent rather than dropping content silently.
- [ ] Rerun conversion tests and snapshot the expected Markdown shape with assertions.

## Task 4: Build Supabase gateways and the content orchestration service

**Files:**

- Create: `api/_lib/supabase.ts`
- Create: `api/_lib/content-service.ts`
- Create: `tests/api/content-service.test.ts`

- [ ] Write failing tests for published-article lookup, non-Feishu articles, successful live refresh, snapshot persistence, Feishu failure with a usable snapshot, and Feishu failure without a snapshot.
- [ ] Add an injectable Supabase gateway with narrow article reads/updates and access-token admin verification.
- [ ] Implement public live-content orchestration independently of the HTTP handler.
- [ ] Ensure snapshot-update failure does not discard successfully fetched Markdown.
- [ ] Implement authenticated preview orchestration and reject non-admin users before contacting Feishu.
- [ ] Run focused tests and confirm success/fallback boundaries.

## Task 5: Expose content and media Serverless APIs

**Files:**

- Create: `api/feishu-content.ts`
- Create: `api/feishu-media.ts`
- Create: `tests/api/handlers.test.ts`
- Modify: `vercel.json`

- [ ] Write failing handler tests for GET query validation, POST body/auth validation, cache headers, stale responses, media signature tampering, and streamed upstream response headers.
- [ ] Implement Web Standard `GET`/`POST` handlers with consistent JSON errors.
- [ ] Add public CDN caching (`s-maxage=60`, `stale-while-revalidate=300`) and no-store admin preview responses.
- [ ] Implement media signature validation and one-day proxy caching.
- [ ] Exclude `/api/` from the SPA rewrite.
- [ ] Run handler tests and verify response status, body, and cache headers.

## Task 6: Add schema fields and simplify the admin workflow

**Files:**

- Create: `database/migrations/003_feishu_live_content.sql`
- Modify: `src/app/data/posts.ts`
- Modify: `src/app/content/repository.ts`
- Modify: `src/app/pages/AdminArticles.tsx`
- Create: `src/app/content/liveContent.ts`
- Create: `tests/frontend/live-content.test.ts`

- [ ] Add nullable Feishu URL, revision, and synchronization timestamp columns with comments and no new client-side secrets.
- [ ] Extend the article model and row normalization for these fields.
- [ ] Write failing tests for preview response parsing and live-content merge/fallback helpers.
- [ ] Remove local `configId`, converter base URL, Feishu app-key, OBS, and configuration-modal code.
- [ ] Add an authenticated same-origin preview request using the current Supabase access token.
- [ ] Keep a single Feishu URL field and a “同步预览并覆盖正文” action, with overwrite confirmation when local Markdown is non-empty.
- [ ] Persist the Feishu URL with article writes and populate it when editing.
- [ ] Run the focused frontend helper tests.

## Task 7: Prefer live content on the article page with snapshot fallback

**Files:**

- Modify: `src/app/content/repository.ts`
- Modify: `src/app/pages/Post.tsx` only if rendering integration requires it
- Modify: `tests/frontend/live-content.test.ts`

- [ ] Add tests proving linked articles merge successful live Markdown and preserve snapshots when the live endpoint fails.
- [ ] Update `getArticleBySlug` to return the database snapshot immediately as its safe base and call `/api/feishu-content?slug=...` only for linked articles.
- [ ] Keep static-content and non-Feishu article behavior unchanged.
- [ ] Verify the existing `ReactMarkdown` pipeline renders returned Markdown without a second renderer.

## Task 8: Configuration, verification, and delivery

**Files:**

- Modify: `.env.example`
- Modify: `README.md` or the existing deployment documentation closest to environment setup
- Review: `docs/superpowers/specs/2026-08-28-feishu-live-content-design.md`

- [ ] Document server-only Feishu, media-signing, and Supabase service-role variables separately from `VITE_` browser variables.
- [ ] Document required Feishu application permissions and the database migration command.
- [ ] Run the complete test suite from a clean command invocation.
- [ ] Run TypeScript/Vite production build and any repository lint/static checks.
- [ ] Exercise handler validation locally with synthetic requests so no real Feishu credentials are required for the basic check.
- [ ] Inspect `git diff` for leaked credentials, accidental unrelated changes, and stale references to `configId`, OBS, or `feishu2md` in runtime code.
- [ ] Commit only the intended implementation and documentation files, preserving unrelated user files.
