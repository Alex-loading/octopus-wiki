-- Run after migration 007 on a test database as its owner. Fixtures always roll back.
begin;
insert into public.bookmark_collections(id,name,is_public) values
 ('7b000000-0000-0000-0000-000000000001','__bookmark_public_test__',true),
 ('7b000000-0000-0000-0000-000000000002','__bookmark_private_test__',false);
insert into public.bookmarks(id,collection_id,url,canonical_url,title,is_public) values
 ('7b100000-0000-0000-0000-000000000001','7b000000-0000-0000-0000-000000000001','https://example.com/test-public','https://example.com/test-public','public',true),
 ('7b100000-0000-0000-0000-000000000002','7b000000-0000-0000-0000-000000000001','https://example.com/test-private','https://example.com/test-private','private resource',false),
 ('7b100000-0000-0000-0000-000000000003','7b000000-0000-0000-0000-000000000002','https://example.com/test-hidden-box','https://example.com/test-hidden-box','private box resource',true);

set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if (select count(*) from public.bookmark_collections where id::text like '7b000000-%') <> 1 then raise exception 'Anonymous collection visibility failed'; end if;
 if (select count(*) from public.bookmarks where id::text like '7b100000-%') <> 1 then raise exception 'Anonymous resource visibility failed'; end if;
 begin
  insert into public.bookmark_collections(name) values ('__must_not_exist__');
  raise exception 'Anonymous insert must fail';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{},"user_metadata":{"role":"admin","is_admin":true}}',true);
do $$ declare n integer; begin
 if (select count(*) from public.bookmarks where id::text like '7b100000-%') <> 1 then raise exception 'Reader visibility failed'; end if;
 begin
  insert into public.bookmark_collections(name) values ('__spoof_must_not_exist__');
  raise exception 'Spoofed role insert must fail';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.bookmarks(collection_id,url,canonical_url,title) values ('7b000000-0000-0000-0000-000000000001','https://example.com/reader','https://example.com/reader','reader');
  raise exception 'Reader bookmark insert must fail';
 exception when insufficient_privilege then null; end;
 update public.bookmarks set title='tampered' where id='7b100000-0000-0000-0000-000000000001';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Reader update must affect no records'; end if;
 delete from public.bookmarks where id='7b100000-0000-0000-0000-000000000001';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Reader delete must affect no records'; end if;
end $$;

select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
do $$ begin
 if (select count(*) from public.bookmarks where id::text like '7b100000-%') <> 3 then raise exception 'Admin read failed'; end if;
 begin
  insert into public.bookmarks(collection_id,url,canonical_url,title) values ('7b000000-0000-0000-0000-000000000001','https://example.com/test-public','https://example.com/test-public','duplicate');
  raise exception 'Duplicate bookmark must fail';
 exception when unique_violation then null; end;
 begin
  insert into public.bookmark_collections(name) values (' __BOOKMARK_PUBLIC_TEST__ ');
  raise exception 'Duplicate collection must fail';
 exception when unique_violation then null; end;
 begin
  delete from public.bookmark_collections where id='7b000000-0000-0000-0000-000000000001';
  raise exception 'Nonempty collection delete must fail';
 exception when foreign_key_violation or sqlstate '23001' then null; end;
 begin
  update public.bookmarks set url='javascript:alert(1)' where id='7b100000-0000-0000-0000-000000000001';
  raise exception 'Active URL must fail';
 exception when check_violation then null; end;
 update public.bookmarks set collection_id='7b000000-0000-0000-0000-000000000002' where id='7b100000-0000-0000-0000-000000000001';
end $$;

set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if exists (select 1 from public.bookmarks where id='7b100000-0000-0000-0000-000000000001') then raise exception 'Moved bookmark must become private'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{"is_admin":true}}',true);
do $$ declare created_id uuid; n integer; begin
 insert into public.bookmark_collections(name,is_public) values ('__boolean_admin_test__',false) returning id into created_id;
 insert into public.bookmarks(collection_id,url,canonical_url,title) values (created_id,'https://example.com/admin','https://example.com/admin','boolean admin');
 update public.bookmarks set title='edited' where collection_id=created_id;
 get diagnostics n = row_count;
 if n <> 1 then raise exception 'Boolean admin update failed'; end if;
 delete from public.bookmarks where collection_id=created_id;
 delete from public.bookmark_collections where id=created_id;
end $$;
reset role;
rollback;
