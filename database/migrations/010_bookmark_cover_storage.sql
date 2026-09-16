-- Keep original source URLs; only persistent object paths are stored alongside them.
begin;
alter table public.bookmarks add column if not exists cover_storage_path text not null default ''
  check (cover_storage_path = '' or cover_storage_path ~ '^[a-f0-9]{64}\.(jpg|png|webp|gif|avif)$');
create index if not exists bookmarks_cover_storage_path_idx on public.bookmarks(cover_storage_path)
  where cover_storage_path <> '';

-- Plain PostgreSQL development databases do not include Supabase Storage.
do $$ begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
      values ('bookmark-covers', 'bookmark-covers', false, 8388608,
        array['image/jpeg','image/png','image/webp','image/gif','image/avif'])
      on conflict (id) do nothing;
    if exists (select 1 from storage.buckets where id = 'bookmark-covers' and public) then
      raise exception 'bookmark-covers must be private';
    end if;
    -- The linked row's existing RLS determines public/admin access, including the
    -- collection visibility. An unreferenced or deleted cover is never public.
    drop policy if exists "Read visible bookmark covers" on storage.objects;
    create policy "Read visible bookmark covers" on storage.objects
      for select to anon, authenticated using (
        bucket_id = 'bookmark-covers' and exists (
          select 1 from public.bookmarks b where b.cover_storage_path = storage.objects.name
        )
      );
  else
    raise notice 'Supabase Storage schema is absent; apply this migration in Supabase before archiving covers.';
  end if;
end $$;
commit;
