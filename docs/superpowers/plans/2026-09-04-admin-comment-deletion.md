# Admin-only comment deletion

> Execute inline with the executing-plans, test-driven-development, and verification-before-completion skills. Keep existing uncommitted work; do not commit or apply remote migrations.

**Goal:** Administrators may delete any comment; anonymous and ordinary authenticated readers may not delete any comments, including their own.

**Architecture:** Reuse the Supabase client and verified administrator role. Grant DELETE to authenticated with an administrator-only restrictive RLS policy, in addition to migration 004's existing administrator policy. Keep public SELECT/INSERT unchanged. Use a small comment deletion control with confirmation, pending state, and inline errors. Remove the exact comment from the page only after the database returns its deleted ID. Do not change authentication persistence or add visitor ownership.

**Tech stack:** React, TypeScript, Supabase/PostgreSQL, Node test runner, Vite, jsdom.

## Tasks

- [x] Add failing repository tests in `tests/frontend/comment-deletion-repository.test.ts`: reject guests/non-admins before writes; accept both existing admin claims; constrain deletion by comment and article IDs; handle denied, zero-row and failed requests.
- [x] Add failing component tests in `tests/frontend/comment-delete-button.test.ts`: hidden for readers, cancel without writes, confirmation before deletion, disable during requests, show failures and allow retry.
- [x] Add migration contract coverage in `tests/database/article-interactions-migration.test.ts`. Add a rolled-back SQL permissions test for anonymous, regular, spoofed user metadata and administrator identities.
- [x] Run targeted tests and record expected missing-feature failures.
- [x] Add `database/migrations/005_admin_comment_deletion.sql` without changing 004. Use `revoke delete ... from public, anon`, `grant delete ... to authenticated`, and `as restrictive for delete to authenticated` with trusted `app_metadata` admin claims.
- [x] Add `deleteArticleComment(articleId, commentId)` to `src/app/content/repository.ts`. Validate admin with `getUserRoleState()`, use `.delete().eq("id", commentId).eq("article_id", articleId).select("id").maybeSingle()`, and return a failed result if no row was returned. Catch failures.
- [x] Add `src/app/components/CommentDeleteButton.tsx`; integrate with `Post.tsx`. Observe auth changes without awaiting Supabase calls inside the auth callback, fail closed while checking roles, unsubscribe on unmount, and prevent stale role lookups from restoring revoked UI access.
- [x] Update `scripts/db/README.md` with migration ordering, administrator-only deletion, and verification instructions. Existing comments are deletable by admins; deletion is permanent and confirmed in the UI.
- [x] Run targeted tests, the full test suite, production build and `git diff --check`. Check for a disposable local database; never delete real comments for testing.

## Verification evidence

- RED: 11 new tests failed for the missing migration, component and repository function; existing migration test passed.
- GREEN: 12 targeted tests passed.
- `node --import tsx --test tests/**/*.test.ts`: 55 tests passed (including concurrent author-feature tests).
- `npm run build`: passed; existing bundle-size warning remains.
- `git diff --check`: passed.
- Actual PostgreSQL permission script not executed: local Docker daemon is not running, and only `psql` is installed. `scripts/db/verify-comment-deletion.sql` is ready for a test database. No remote migration or real-comment deletion was performed.
- Tests use an isolated temporary Vite cache and jsdom is explicitly declared as a development dependency; no test contacts real Supabase.

## Acceptance

Admin login followed by in-app navigation to an article exposes Delete on every comment. Cancelling does nothing; success removes one comment and updates the displayed count; errors keep the comment. Readers have no delete control and cannot bypass RLS. Existing in-memory authentication remains unchanged: refresh/new-tab login persistence is outside this change. Supabase migration 005 must be applied after 004 before deletion works remotely.
