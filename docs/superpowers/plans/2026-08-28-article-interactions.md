# Article Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw timestamps, fake likes/comments, and bookmark state with formatted dates and persistent anonymous Supabase interactions.

**Architecture:** Article rows expose an aggregate like count. A private like-detail table and security-definer RPCs provide idempotent per-browser likes without exposing visitor IDs. Comments use a public-read/constrained-public-insert table with RLS; the existing Supabase browser client reads and writes the interaction data.

**Tech Stack:** React, TypeScript, Vite, Supabase/PostgreSQL, Node test runner via `tsx`.

---

### Task 1: Define display and anonymous-input behavior

**Files:**

- Create: `src/app/content/articleInteractions.ts`
- Create: `tests/frontend/article-interactions.test.ts`

- [ ] Add failing tests requiring `formatArticleDateTime("2026-08-28T09:53:48.867+00:00")` to return `2026-08-28 09:53`, empty names to normalize to `匿名`, names/bodies to be trimmed and length-bounded, and visitor IDs to be reused from storage.
- [ ] Run `./node_modules/.bin/tsx --test tests/frontend/article-interactions.test.ts` and confirm the missing module fails.
- [ ] Implement `formatArticleDateTime`, `normalizeCommentAuthor`, `normalizeCommentContent`, `commentAvatar`, and injected-storage `getOrCreateArticleVisitorId`.
- [ ] Rerun the focused test and confirm all helper cases pass.

### Task 2: Add the persisted interaction schema

**Files:**

- Create: `database/migrations/004_article_interactions.sql`
- Create: `tests/database/article-interactions-migration.test.ts`
- Modify: `scripts/db/README.md`

- [ ] Add a failing migration-contract test requiring an article `like_count`, private `article_likes`, public `article_comments`, RLS policies, public grants limited to comments, and security-definer like RPCs with public-table privileges revoked.
- [ ] Run the migration-contract test and confirm it fails because migration `004` is absent.
- [ ] Create an idempotent migration with `get_article_like_state(uuid, uuid)` and `set_article_like(uuid, uuid, boolean)` functions. The setter inserts/deletes the unique like row and adjusts `articles.like_count` only when a row changes.
- [ ] Add comment constraints (`author_name` 1–40, `content` 1–1000) and policies that require a published, non-deleted parent article.
- [ ] Update database documentation to include migration `003` and `004`, their tables/columns, and the existing `npm run db:init` command.
- [ ] Rerun the migration-contract test.

### Task 3: Add interaction repository operations

**Files:**

- Modify: `src/app/data/posts.ts`
- Modify: `src/app/content/repository.ts`
- Modify: `tests/frontend/article-interactions.test.ts`

- [ ] Extend `Post` with optional `likeCount` and include `like_count` in article selects/normalization.
- [ ] Add `getArticleLikeState(articleId, visitorId)`, `setArticleLiked(articleId, visitorId, liked)`, `listArticleComments(articleId)`, and `createArticleComment(articleId, authorName, content)` using the existing anonymous Supabase client.
- [ ] Return stable empty/default states when Supabase is unavailable and map database failures to user-facing errors.
- [ ] Normalize comment rows to the shared `ArticleComment` type and format timestamps at render time.
- [ ] Run the frontend interaction tests and production build type-check.

### Task 4: Replace fake UI state and remove bookmarks

**Files:**

- Modify: `src/app/components/PostCard.tsx`
- Modify: `src/app/pages/Post.tsx`

- [ ] Remove `Math.random`, bookmark imports/state/buttons, and mock comment fixtures from cards and detail pages.
- [ ] Make cards show `post.likeCount ?? 0` as a non-interactive persisted statistic.
- [ ] Load like state and comments when a detail article resolves; show safe zero/empty fallback states if loading fails.
- [ ] Make the detail like button call the RPC, disable during writes, and render database-returned count/state.
- [ ] Add an optional 40-character nickname input with “留空则匿名”, a required 1000-character comment body, submitting/error states, and prepend the returned database comment.
- [ ] Render real comment names, initials, formatted timestamps, an empty state, and a loading state.

### Task 5: Verify and deliver

**Files:**

- Review all scoped changes while preserving unrelated dirty-worktree files.

- [ ] Run `npm test` and confirm zero failures.
- [ ] Run `npm run build` and confirm the production bundle compiles.
- [ ] Run `git diff --check` and search runtime code for `Math.random`, `Bookmark`, `bookmarked`, and `MOCK_COMMENTS`.
- [ ] Confirm the migration is documented as a required deployment step and report that it was not applied to a remote database automatically.
