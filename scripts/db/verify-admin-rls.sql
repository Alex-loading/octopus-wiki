-- Verify admin authz and article write workflow constraints

-- 1) non-admin direct mutation SHOULD be blocked
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated","app_metadata":{}}';

do $$
begin
  begin
    insert into public.articles(slug, title, summary, content_md, content, status)
    values ('rls-non-admin-test', 'blocked', '', 'x', 'x', 'draft');
    raise exception 'Non-admin insert unexpectedly succeeded';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlstate <> '42501' then
        raise;
      end if;
  end;
end $$;
rollback;

-- 2) admin RLS policy SHOULD exist and include admin claims
do $$
declare
  using_expr text;
  check_expr text;
begin
  select qual, with_check
    into using_expr, check_expr
  from pg_policies
  where schemaname = 'public'
    and tablename = 'articles'
    and policyname = 'Admins can manage all articles';

  if using_expr is null or check_expr is null then
    raise exception 'Admin policy is missing on public.articles';
  end if;

  if position('app_metadata' in using_expr) = 0 or position('admin' in using_expr) = 0 then
    raise exception 'Admin policy using expression does not include admin claim checks';
  end if;

  if position('app_metadata' in check_expr) = 0 or position('admin' in check_expr) = 0 then
    raise exception 'Admin policy check expression does not include admin claim checks';
  end if;
end $$;

-- 3) owner-level smoke test SHOULD still support insert/update/delete transactionally
begin;
do $$
declare
  slug_val text := 'owner-smoke-' || substr(gen_random_uuid()::text, 1, 8);
  row_id uuid;
begin
  insert into public.articles(slug, title, summary, content_md, content, status)
  values (slug_val, 'owner smoke', '', 'x', 'x', 'draft')
  returning id into row_id;

  update public.articles set summary = 'owner-updated' where id = row_id;
  update public.articles set deleted_at = now() where id = row_id;
end $$;
rollback;

-- 4) duplicate slug SHOULD be rejected
begin;

do $$
declare
  dup_slug text := 'dup-' || substr(gen_random_uuid()::text, 1, 8);
begin
  insert into public.articles(slug, title, summary, content_md, content, status)
  values (dup_slug, 'first', '', 'x', 'x', 'draft');

  begin
    insert into public.articles(slug, title, summary, content_md, content, status)
    values (dup_slug, 'second', '', 'x', 'x', 'draft');
    raise exception 'Duplicate slug insert unexpectedly succeeded';
  exception
    when unique_violation then
      null;
  end;
end $$;
rollback;
