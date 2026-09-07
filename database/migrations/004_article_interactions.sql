-- Persistent anonymous likes and comments (idempotent)

alter table if exists public.articles
  add column if not exists like_count integer not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'articles_like_count_nonnegative'
  ) then
    alter table public.articles
      add constraint articles_like_count_nonnegative check (like_count >= 0);
  end if;
end
$$;

create table if not exists public.article_likes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  visitor_id uuid not null,
  created_at timestamptz not null default now(),
  unique (article_id, visitor_id)
);

create index if not exists idx_article_likes_article_id
  on public.article_likes(article_id);

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_name text not null default '匿名'
    check (char_length(btrim(author_name)) between 1 and 40),
  content text not null
    check (char_length(btrim(content)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_article_comments_article_created_at
  on public.article_comments(article_id, created_at desc);

alter table public.article_likes enable row level security;
alter table public.article_comments enable row level security;

drop policy if exists "Public can read comments on published articles" on public.article_comments;
create policy "Public can read comments on published articles"
on public.article_comments
for select
to public
using (
  exists (
    select 1
    from public.articles
    where articles.id = article_comments.article_id
      and articles.status = 'published'
      and articles.deleted_at is null
  )
);

drop policy if exists "Public can comment on published articles" on public.article_comments;
create policy "Public can comment on published articles"
on public.article_comments
for insert
to public
with check (
  exists (
    select 1
    from public.articles
    where articles.id = article_comments.article_id
      and articles.status = 'published'
      and articles.deleted_at is null
  )
);

drop policy if exists "Admins can manage article comments" on public.article_comments;
create policy "Admins can manage article comments"
on public.article_comments
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

create or replace function public.get_article_like_state(
  p_article_id uuid,
  p_visitor_id uuid
)
returns table(like_count integer, liked boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    articles.like_count,
    exists (
      select 1
      from public.article_likes
      where article_likes.article_id = p_article_id
        and article_likes.visitor_id = p_visitor_id
    )
  from public.articles
  where articles.id = p_article_id
    and articles.status = 'published'
    and articles.deleted_at is null;
$$;

create or replace function public.set_article_like(
  p_article_id uuid,
  p_visitor_id uuid,
  p_liked boolean
)
returns table(like_count integer, liked boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_rows integer := 0;
begin
  if not exists (
    select 1
    from public.articles
    where articles.id = p_article_id
      and articles.status = 'published'
      and articles.deleted_at is null
  ) then
    raise exception 'article is unavailable';
  end if;

  if p_liked then
    insert into public.article_likes(article_id, visitor_id)
    values (p_article_id, p_visitor_id)
    on conflict (article_id, visitor_id) do nothing;
    get diagnostics changed_rows = row_count;

    if changed_rows > 0 then
      update public.articles as target
      set like_count = target.like_count + 1
      where target.id = p_article_id;
    end if;
  else
    delete from public.article_likes
    where article_likes.article_id = p_article_id
      and article_likes.visitor_id = p_visitor_id;
    get diagnostics changed_rows = row_count;

    if changed_rows > 0 then
      update public.articles as target
      set like_count = greatest(0, target.like_count - 1)
      where target.id = p_article_id;
    end if;
  end if;

  return query
  select
    articles.like_count,
    exists (
      select 1
      from public.article_likes
      where article_likes.article_id = p_article_id
        and article_likes.visitor_id = p_visitor_id
    )
  from public.articles
  where articles.id = p_article_id;
end;
$$;

revoke all on table public.article_likes from anon, authenticated;
revoke all on table public.article_comments from anon, authenticated;
grant select, insert on table public.article_comments to anon, authenticated;

revoke all on function public.get_article_like_state(uuid, uuid) from public;
revoke all on function public.set_article_like(uuid, uuid, boolean) from public;
grant execute on function public.get_article_like_state(uuid, uuid) to anon, authenticated;
grant execute on function public.set_article_like(uuid, uuid, boolean) to anon, authenticated;
