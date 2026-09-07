-- Run as database owner in a test database after migrations 007 and 008.
begin;
insert into auth.users(id) values ('8b000000-0000-0000-0000-000000000001');
insert into public.bookmark_capture_devices(user_id,token_hash,expires_at)
values ('8b000000-0000-0000-0000-000000000001',repeat('a',64),now()+interval '90 days');

set local role anon;
do $$ begin
 begin
  perform 1 from public.bookmark_capture_devices;
  raise exception 'Anonymous clients must never read device credentials';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.bookmark_capture_devices(user_id,token_hash,expires_at)
  values ('8b000000-0000-0000-0000-000000000001',repeat('b',64),now()+interval '90 days');
  raise exception 'Anonymous clients must never issue device credentials';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
do $$ begin
 begin
  perform 1 from public.bookmark_capture_devices;
  raise exception 'Even administrator browser clients must not read hashes';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.bookmark_capture_devices(user_id,token_hash,expires_at)
  values ('8b000000-0000-0000-0000-000000000001',repeat('b',64),now()+interval '90 days');
  raise exception 'Browser clients must not issue credentials directly';
 exception when insufficient_privilege then null; end;
 begin
  update public.bookmark_capture_devices set expires_at=now()+interval '100 years';
  raise exception 'Browser clients must not extend credentials directly';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.bookmark_capture_devices;
  raise exception 'Browser clients must not delete credentials directly';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role service_role;
do $$ declare box_id uuid; n integer; begin
 if not exists (select 1 from public.bookmark_capture_devices where token_hash=repeat('a',64)) then
  raise exception 'Server cannot look up device credentials'; end if;
 begin
  insert into public.bookmark_capture_devices(user_id,token_hash,expires_at)
  values ('8b000000-0000-0000-0000-000000000001','plaintext-token',now()+interval '90 days');
  raise exception 'Non-hash credentials must fail validation';
 exception when check_violation then null; end;
 begin
  insert into public.bookmark_capture_devices(user_id,token_hash,expires_at)
  values ('8b000000-0000-0000-0000-000000000001',repeat('a',64),now()+interval '90 days');
  raise exception 'Duplicate hashes must be rejected';
 exception when unique_violation then null; end;
 update public.bookmark_capture_devices set revoked_at=now() where token_hash=repeat('a',64);
 get diagnostics n = row_count;
 if n <> 1 then raise exception 'Server revocation failed'; end if;
 insert into public.bookmark_collections(name,is_public) values ('__collector_private__',false) returning id into box_id;
 insert into public.bookmarks(collection_id,url,canonical_url,title,is_public)
 values (box_id,'https://example.com/collector-test','https://example.com/collector-test','collector',false);
 if not exists (select 1 from public.bookmarks where collection_id=box_id) then raise exception 'Scoped server capture failed'; end if;
end $$;
reset role;
delete from auth.users where id='8b000000-0000-0000-0000-000000000001';
do $$ begin
 if exists (select 1 from public.bookmark_capture_devices where token_hash=repeat('a',64)) then
  raise exception 'Deleted accounts must not retain device credentials'; end if;
end $$;
rollback;
