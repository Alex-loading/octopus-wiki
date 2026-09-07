-- Requires 004_article_interactions.sql. Existing comments need no backfill.
-- Table privileges and RLS both apply: authenticated does NOT imply administrator.
begin;

alter table public.article_comments enable row level security;

revoke delete on table public.article_comments from public, anon;
grant delete on table public.article_comments to authenticated;

-- Migration 004 provides the permissive administrator policy. This restriction
-- also prevents another permissive policy from granting deletion to readers.
drop policy if exists "Only admins can delete article comments" on public.article_comments;
create policy "Only admins can delete article comments"
on public.article_comments
as restrictive
for delete
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
);

commit;
