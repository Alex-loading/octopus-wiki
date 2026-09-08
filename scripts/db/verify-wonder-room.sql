-- Run as database owner after 009. All verification records are rolled back.
begin;
insert into public.demos(id,slug,title,is_public,project_url) values
 ('9d000000-0000-0000-0000-000000000001','__wonder_public_test__','public project',true,'https://example.com/app'),
 ('9d000000-0000-0000-0000-000000000002','__wonder_private_test__','private project',false,'https://github.com/example/project');

set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if (select count(*) from public.demos where id::text like '9d000000-%') <> 1 then raise exception 'Anonymous visibility failed'; end if;
 begin
  insert into public.demos(slug,title) values ('__wonder_anon_denied__','denied');
  raise exception 'Anonymous insert must fail';
 exception when insufficient_privilege then null; end;
 begin
  update public.demos set title='tampered' where id='9d000000-0000-0000-0000-000000000001';
  raise exception 'Anonymous update must fail';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.demos where id='9d000000-0000-0000-0000-000000000001';
  raise exception 'Anonymous delete must fail';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{},"user_metadata":{"role":"admin","is_admin":true}}',true);
do $$ declare n integer; begin
 if (select count(*) from public.demos where id::text like '9d000000-%') <> 1 then raise exception 'Reader visibility failed'; end if;
 begin
  insert into public.demos(slug,title) values ('__wonder_spoof_denied__','denied');
  raise exception 'Spoofed admin insert must fail';
 exception when insufficient_privilege then null; end;
 update public.demos set title='tampered' where id='9d000000-0000-0000-0000-000000000001';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Reader update must affect no records'; end if;
 delete from public.demos where id='9d000000-0000-0000-0000-000000000001';
 get diagnostics n = row_count;
 if n <> 0 then raise exception 'Reader delete must affect no records'; end if;
end $$;

select set_config('request.jwt.claims','{"app_metadata":{"role":"admin"}}',true);
do $$ begin
 if (select count(*) from public.demos where id::text like '9d000000-%') <> 2 then raise exception 'Admin visibility failed'; end if;
 update public.demos set is_public=false,project_url=null where id='9d000000-0000-0000-0000-000000000001';
 if not exists (select 1 from public.demos where id='9d000000-0000-0000-0000-000000000001' and not is_public and project_url is null) then raise exception 'Admin update failed'; end if;
 begin
  update public.demos set project_url='javascript:alert(1)' where id='9d000000-0000-0000-0000-000000000001';
  raise exception 'Active URL must fail';
 exception when check_violation then null; end;
end $$;

set local role anon;
select set_config('request.jwt.claims','{}',true);
do $$ begin
 if exists (select 1 from public.demos where id::text like '9d000000-%') then raise exception 'Hidden projects must disappear'; end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"app_metadata":{"is_admin":true}}',true);
do $$ declare created_id uuid; n integer; begin
 insert into public.demos(slug,title,is_public) values ('__wonder_boolean_admin__','boolean admin',false) returning id into created_id;
 update public.demos set project_url='https://github.com/example/project' where id=created_id;
 get diagnostics n = row_count;
 if n <> 1 then raise exception 'Boolean admin update failed'; end if;
 delete from public.demos where id=created_id;
 get diagnostics n = row_count;
 if n <> 1 then raise exception 'Boolean admin delete failed'; end if;
end $$;
reset role;
rollback;
