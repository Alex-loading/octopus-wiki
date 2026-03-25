-- Article admin extensions: soft delete, audit and RLS policies

alter table if exists public.articles
  add column if not exists deleted_at timestamptz,
  add column if not exists updated_by uuid;

create index if not exists idx_articles_deleted_at on public.articles(deleted_at);

alter table if exists public.articles enable row level security;

drop policy if exists "Public can read published non-deleted articles" on public.articles;
create policy "Public can read published non-deleted articles"
on public.articles
for select
to public
using (
  status = 'published'
  and deleted_at is null
);

drop policy if exists "Admins can manage all articles" on public.articles;
create policy "Admins can manage all articles"
on public.articles
for all
to authenticated
using (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
)
with check (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  or coalesce((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false)
);
