begin;

create table if not exists public.photo_entries (
  id uuid primary key default gen_random_uuid(),
  caption text not null default '' check (char_length(caption) <= 2000),
  occurred_at timestamptz not null default now() check (isfinite(occurred_at)),
  photos jsonb not null check (jsonb_typeof(photos) = 'array'),
  is_public boolean not null default true,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint photo_entries_has_photos check (photos <> '[]'::jsonb)
);

drop trigger if exists photo_entries_check on public.photo_entries;
alter table public.photo_entries add column if not exists is_public boolean not null default false;
do $$
begin
  if exists (select 1 from pg_attribute where attrelid = 'public.photo_entries'::regclass
      and attname = 'status' and not attisdropped) then
    update public.photo_entries set is_public = (status = 'published')
      where is_public is distinct from (status = 'published');
    drop policy if exists "Read published photo entries" on public.photo_entries;
    if to_regclass('storage.objects') is not null then
      drop policy if exists "Read media for published photo entries" on storage.objects;
    end if;
    drop index if exists public.photo_entries_feed_idx;
    alter table public.photo_entries drop column status;
  end if;

  if not exists (select 1 from pg_constraint where conrelid = 'public.photo_entries'::regclass
      and conname = 'photo_entries_has_photos') then
    alter table public.photo_entries add constraint photo_entries_has_photos check (photos <> '[]'::jsonb) not valid;
    if not exists (select 1 from public.photo_entries where photos = '[]'::jsonb) then
      alter table public.photo_entries validate constraint photo_entries_has_photos;
    end if;
  end if;
end;
$$;
alter table public.photo_entries alter column is_public set default true, alter column photos drop default;

create index if not exists photo_entries_feed_idx on public.photo_entries (occurred_at desc, id desc)
  where is_public;
create index if not exists photo_entries_management_idx on public.photo_entries (updated_at desc, id desc);

alter table public.photo_entries enable row level security;
revoke all on public.photo_entries from anon, authenticated;
grant select on public.photo_entries to anon, authenticated;
grant insert, update on public.photo_entries to authenticated;

drop policy if exists "Read public photo entries" on public.photo_entries;
create policy "Read public photo entries" on public.photo_entries for select to anon, authenticated
  using (is_public);

drop policy if exists "Manage photo entries" on public.photo_entries;
create policy "Manage photo entries" on public.photo_entries for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true');

create or replace function public.check_photo_entry()
returns trigger language plpgsql set search_path = '' as $$
declare
  photo jsonb;
  photo_id text;
  photo_ids text[] := '{}';
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      raise exception using errcode = '23514', message = '照片记录的编号不能修改。';
    end if;
    new.revision := old.revision + 1;
    if new.photos is not distinct from old.photos then return new; end if;
  else
    new.revision := 1;
  end if;

  for photo in select value from jsonb_array_elements(new.photos) loop
    photo_id := photo->>'id';
    if photo_id is null or photo_id !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
      or photo_id = any(photo_ids)
      or jsonb_typeof(photo->'width') is distinct from 'number'
      or jsonb_typeof(photo->'height') is distinct from 'number'
      or (photo->>'width') !~ '^[1-9][0-9]{0,3}$'
      or (photo->>'height') !~ '^[1-9][0-9]{0,3}$' then
      raise exception using errcode = '23514', message = '照片编号或尺寸无效。';
    end if;
    if (select count(*) from storage.objects
        where bucket_id = 'photo-entries' and name in (
          new.id || '/' || photo_id || '/thumbnail.jpg', new.id || '/' || photo_id || '/full.jpg'
        )) <> 2 then
      raise exception using errcode = '23514', message = '照片尚未上传完成。';
    end if;
    photo_ids := array_append(photo_ids, photo_id);
  end loop;
  return new;
end;
$$;

create trigger photo_entries_check before insert or update on public.photo_entries
  for each row execute function public.check_photo_entry();

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice '请在 Supabase 应用此迁移以启用照片存储。';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('photo-entries', 'photo-entries', false, 6291456, array['image/jpeg'])
    on conflict (id) do nothing;
  if exists (select 1 from storage.buckets where id = 'photo-entries' and public) then
    raise exception '照片存储桶必须设为私有。';
  end if;

  drop policy if exists "Read media for public photo entries" on storage.objects;
  create policy "Read media for public photo entries" on storage.objects for select to anon, authenticated using (
    bucket_id = 'photo-entries' and exists (
      select 1 from public.photo_entries as entry
      where entry.is_public
        and entry.id = case
          when split_part(name, '/', 1) ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
          then split_part(name, '/', 1)::uuid
        end
        and entry.photos @> jsonb_build_array(jsonb_build_object('id', split_part(name, '/', 2)))
    )
  );

  drop policy if exists "Read private photo media as admin" on storage.objects;
  create policy "Read private photo media as admin" on storage.objects for select to authenticated using (
    bucket_id = 'photo-entries'
    and ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true')
  );

  drop policy if exists "Upload photo media as admin" on storage.objects;
  create policy "Upload photo media as admin" on storage.objects for insert to authenticated with check (
    bucket_id = 'photo-entries' and name ~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/(thumbnail|full)\.jpg$'
    and ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true')
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
