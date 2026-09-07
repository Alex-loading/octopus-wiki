# Feishu-only Article Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Feishu links the only article-body source in the admin console, auto-fill Feishu metadata, and apply a predictable cover-image fallback chain.

**Architecture:** The authenticated preview endpoint returns the Feishu title, Markdown snapshot, revision, and first visual media URL. The admin form keeps the Markdown only as a hidden fallback snapshot, exposes metadata fields, and refuses writes until a Feishu document has been synchronized. Article reads continue to prefer live Feishu content and use the stored snapshot only during upstream failures.

**Tech Stack:** React, TypeScript, Vite, Supabase, Vercel Functions, Feishu OpenAPI, Node test runner via `tsx`.

---

### Task 1: Return a Feishu-derived cover candidate

**Files:**

- Modify: `api/_lib/markdown.ts`
- Modify: `api/_lib/content-service.ts`
- Modify: `api/feishu-content.ts`
- Modify: `src/app/content/liveContent.ts`
- Test: `tests/api/markdown.test.ts`
- Test: `tests/api/handlers.test.ts`
- Test: `tests/frontend/live-content.test.ts`

- [x] Add a failing Markdown conversion assertion requiring `coverImage` to equal the first signed image or board URL.
- [x] Run `npm test -- tests/api/markdown.test.ts` and confirm the missing field causes the failure.
- [x] Extend `MarkdownConversionResult` with `coverImage: string | null`, selecting the first image/board from renderer media order.
- [x] Extend the preview response contract so `FetchedMarkdown` and `FeishuPreview` carry `coverImage`.
- [x] Update handler and frontend parsing tests and run the focused API/frontend tests.

### Task 2: Enforce Feishu-only article writes

**Files:**

- Create: `src/app/content/articleWrite.ts`
- Modify: `src/app/content/repository.ts`
- Test: `tests/frontend/article-write.test.ts`

- [x] Add failing tests showing a write is rejected without a Feishu URL or synchronized Markdown snapshot.
- [x] Add failing cover-resolution tests for manual URL, Feishu first image, and no cover.
- [x] Run `npm test -- tests/frontend/article-write.test.ts` and confirm the new module is missing.
- [x] Define `FeishuArticleWriteInput`, `validateFeishuArticleInput`, and `resolveArticleCover` in the pure helper module.
- [x] Update repository writes to store only `contentSnapshot`, require the Feishu URL/snapshot, and persist a null cover when both cover sources are absent so row normalization supplies the site default.
- [x] Run the focused helper tests.

### Task 3: Remove manual Markdown editing from the admin form

**Files:**

- Modify: `src/app/pages/AdminArticles.tsx`

- [x] Replace form `content` with a non-editable `contentSnapshot` plus an internal `feishuCoverImage` candidate.
- [x] Clear the snapshot/revision/cover candidate whenever the Feishu URL changes, preventing a snapshot from one document being saved against another URL.
- [x] Rename the synchronization action to “读取飞书信息”, auto-fill the title for new articles, and retain the Markdown only in form state.
- [x] Remove the Markdown textarea and overwrite confirmation.
- [x] Add slug help text explaining that it forms `/blog/:slug`, and label the cover field as optional with its fallback order.
- [x] Show the detected/manual cover preview and synchronization state while preserving existing light/dark styling.

### Task 4: Verify the complete behavior

**Files:**

- Review all changed files and existing unrelated worktree changes.

- [x] Run `npm test` and confirm zero failures.
- [x] Run `npm run build` and confirm the production bundle compiles.
- [x] Inspect `git diff --check` and the scoped diff for leaked credentials, accidental Markdown editing controls, and unrelated modifications.
- [x] Verify the requirements: Feishu URL required; title auto-filled; slug documented; summary/category/tags present; cover precedence is manual, then first Feishu visual, then site fallback; article body is not editable.
