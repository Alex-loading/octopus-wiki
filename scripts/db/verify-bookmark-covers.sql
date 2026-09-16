\set ON_ERROR_STOP on
begin;
insert into public.bookmark_collections (id,name,is_public) values
  ('10000000-9999-4999-9999-000000000001','Cover policy test public',true),
  ('10000000-9999-4999-9999-000000000002','Cover policy test private',false);
insert into public.bookmarks (collection_id,url,canonical_url,title,is_public,cover_storage_path) values
  ('10000000-9999-4999-9999-000000000001','https://example.com/cover-test-public','https://example.com/cover-test-public','test',true,repeat('a',64)||'.png'),
  ('10000000-9999-4999-9999-000000000001','https://example.com/cover-test-private','https://example.com/cover-test-private','test',false,repeat('b',64)||'.png'),
  ('10000000-9999-4999-9999-000000000002','https://example.com/cover-test-private-box','https://example.com/cover-test-private-box','test',true,repeat('c',64)||'.png');
insert into storage.objects (bucket_id,name) values
  ('bookmark-covers',repeat('a',64)||'.png'),
  ('bookmark-covers',repeat('b',64)||'.png'),
  ('bookmark-covers',repeat('c',64)||'.png'),
  ('bookmark-covers',repeat('d',64)||'.png');
set local role anon;
do $$ begin
  if (select count(*) from storage.objects where bucket_id='bookmark-covers' and name in
    (repeat('a',64)||'.png',repeat('b',64)||'.png',repeat('c',64)||'.png',repeat('d',64)||'.png')) <> 1 then
    raise exception 'Anonymous users must only read the public bookmark in the public collection';
  end if;
end $$;
reset role;
set local request.jwt.claims = '{"role":"authenticated","app_metadata":{"role":"admin"}}';
set local role authenticated;
do $$ begin
  if (select count(*) from storage.objects where bucket_id='bookmark-covers' and name in
    (repeat('a',64)||'.png',repeat('b',64)||'.png',repeat('c',64)||'.png',repeat('d',64)||'.png')) <> 3 then
    raise exception 'Admins must read linked private covers but not orphaned objects';
  end if;
end $$;
reset role;
update public.bookmark_collections set is_public=false where id='10000000-9999-4999-9999-000000000001';
set local request.jwt.claims = '{}';
set local role anon;
do $$ begin
  if exists (select 1 from storage.objects where bucket_id='bookmark-covers' and name=repeat('a',64)||'.png') then
    raise exception 'Changing collection visibility must immediately restrict cover access';
  end if;
end $$;
reset role;
rollback;
