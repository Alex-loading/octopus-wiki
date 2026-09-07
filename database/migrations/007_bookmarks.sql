-- Personal bookmark library. Safe to reapply; does not change article data.
begin;

create table if not exists public.bookmark_collections (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 80),
  description text not null default '' check (length(description) <= 500),
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists bookmark_collections_name_key
  on public.bookmark_collections (lower(btrim(name)));

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.bookmark_collections(id) on delete restrict,
  url text not null check (length(url) <= 4096 and url ~* '^https?://[^/@[:space:]]+([/?#]|$)'),
  canonical_url text not null check (length(canonical_url) <= 4096 and canonical_url ~* '^https?://[^/@[:space:]]+([/?#]|$)'),
  title text not null check (length(btrim(title)) between 1 and 300),
  cover_url text not null default '' check (length(cover_url) <= 4096 and (cover_url = '' or cover_url ~* '^https?://[^/@[:space:]]+([/?#]|$)')),
  note text not null default '' check (length(note) <= 2000),
  platform text not null default 'other' check (platform in ('bilibili', 'douyin', 'xiaohongshu', 'nowcoder', 'other')),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Digest avoids PostgreSQL B-tree entry size limits on long signed URLs.
create unique index if not exists bookmarks_canonical_url_key on public.bookmarks (md5(canonical_url));
create index if not exists bookmarks_collection_created_idx on public.bookmarks(collection_id, created_at desc);

create or replace function public.set_bookmark_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists bookmark_collections_updated_at on public.bookmark_collections;
create trigger bookmark_collections_updated_at before update on public.bookmark_collections
  for each row execute function public.set_bookmark_updated_at();
drop trigger if exists bookmarks_updated_at on public.bookmarks;
create trigger bookmarks_updated_at before update on public.bookmarks
  for each row execute function public.set_bookmark_updated_at();

alter table public.bookmark_collections enable row level security;
alter table public.bookmarks enable row level security;
revoke all on public.bookmark_collections, public.bookmarks from anon, authenticated;
grant select on public.bookmark_collections, public.bookmarks to anon;
grant select, insert, update, delete on public.bookmark_collections, public.bookmarks to authenticated;

drop policy if exists "Public bookmark collections" on public.bookmark_collections;
create policy "Public bookmark collections" on public.bookmark_collections for select to anon, authenticated
  using (is_public);
drop policy if exists "Admin bookmark collections" on public.bookmark_collections;
create policy "Admin bookmark collections" on public.bookmark_collections for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true');

drop policy if exists "Public bookmarks" on public.bookmarks;
create policy "Public bookmarks" on public.bookmarks for select to anon, authenticated
  using (is_public and exists (select 1 from public.bookmark_collections c where c.id = collection_id and c.is_public));
drop policy if exists "Admin bookmarks" on public.bookmarks;
create policy "Admin bookmarks" on public.bookmarks for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true');

commit;
