-- Per-article signature and built-in avatar. Existing article RLS remains unchanged.
begin;

alter table public.articles
  add column if not exists author_name text,
  add column if not exists author_avatar text not null default 'everyday';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.articles'::regclass and conname = 'articles_author_name_length'
  ) then
    alter table public.articles add constraint articles_author_name_length
      check (author_name is null or char_length(btrim(author_name)) <= 40);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.articles'::regclass and conname = 'articles_author_avatar_valid'
  ) then
    alter table public.articles add constraint articles_author_avatar_valid
      check (author_avatar in ('everyday', 'chill', 'sleepy', 'inspired', 'focused', 'happy'));
  end if;
end $$;

comment on column public.articles.author_name is 'Optional per-article signature; blank displays Octopus.';
comment on column public.articles.author_avatar is 'Built-in pixel octopus avatar identifier.';

commit;
