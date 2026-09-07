-- Run as the database owner in a TEST database after migrations 001–005.
-- Only randomly generated fixtures are targeted. Everything is rolled back.
begin;

do $$
declare
  published_id uuid := gen_random_uuid();
  draft_id uuid := gen_random_uuid();
  published_comment_id uuid := gen_random_uuid();
  draft_comment_id uuid := gen_random_uuid();
  untouched_id uuid := gen_random_uuid();
begin
  insert into public.articles(id, slug, title, status)
  values
    (published_id, 'comment-delete-test-' || published_id::text, 'Comment deletion test', 'published'),
    (draft_id, 'comment-delete-test-' || draft_id::text, 'Comment deletion draft test', 'draft');
  insert into public.article_comments(id, article_id, author_name, content)
  values
    (published_comment_id, published_id, '测试', 'published comment fixture'),
    (draft_comment_id, draft_id, '测试', 'draft comment fixture'),
    (untouched_id, published_id, '测试', 'must remain untouched');
  perform set_config('comment_delete_test.article_id', published_id::text, true);
  perform set_config('comment_delete_test.published_id', published_comment_id::text, true);
  perform set_config('comment_delete_test.draft_id', draft_comment_id::text, true);
  perform set_config('comment_delete_test.untouched_id', untouched_id::text, true);
end $$;

-- Guests still read/post comments, but have no table-level DELETE grant.
set local role anon;
set local request.jwt.claims = '{"role":"anon","app_metadata":{}}';
do $$
begin
  if not exists (select 1 from public.article_comments where id = current_setting('comment_delete_test.published_id')::uuid) then
    raise exception 'Guest comment reading was broken';
  end if;
  insert into public.article_comments(article_id, content)
  values (current_setting('comment_delete_test.article_id')::uuid, 'guest posting still works');
  begin
    delete from public.article_comments where id = current_setting('comment_delete_test.published_id')::uuid;
    raise exception 'Guest DELETE unexpectedly allowed';
  exception when insufficient_privilege then
    null;
  end;
end $$;
reset role;

-- Ordinary authenticated users cannot delete even a comment they just posted.
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{}}';
do $$
declare
  own_id uuid;
  affected integer;
begin
  insert into public.article_comments(article_id, content)
  values (current_setting('comment_delete_test.article_id')::uuid, 'reader own comment')
  returning id into own_id;
  delete from public.article_comments where id in (own_id, current_setting('comment_delete_test.published_id')::uuid);
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Reader deleted a comment'; end if;
end $$;

-- User-editable metadata is never authority, even if it claims administrator.
set local request.jwt.claims = '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated","app_metadata":{},"user_metadata":{"role":"admin","is_admin":true}}';
do $$
declare affected integer;
begin
  delete from public.article_comments where id = current_setting('comment_delete_test.published_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Spoofed user metadata authorized deletion'; end if;
end $$;

-- Trusted app_metadata.role grants deletion of existing published comments.
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","app_metadata":{"role":"admin"}}';
do $$
declare affected integer;
begin
  delete from public.article_comments where id = current_setting('comment_delete_test.published_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Admin role could not delete published comment'; end if;
end $$;

-- Trusted app_metadata.is_admin also works, including non-public article comments.
set local request.jwt.claims = '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated","app_metadata":{"is_admin":true}}';
do $$
declare affected integer;
begin
  delete from public.article_comments where id = current_setting('comment_delete_test.draft_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Admin flag could not delete draft comment'; end if;

  delete from public.article_comments where id = current_setting('comment_delete_test.published_id')::uuid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Repeated deletion affected another row'; end if;
end $$;
reset role;

do $$
begin
  if not exists (select 1 from public.article_comments where id = current_setting('comment_delete_test.untouched_id')::uuid) then
    raise exception 'An unrelated comment was deleted';
  end if;
end $$;

rollback;
