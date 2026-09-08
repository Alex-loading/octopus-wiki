-- 妙妙屋: real projects, optional project link and administrator management.
begin;

alter table public.demos
  add column if not exists project_url text,
  add column if not exists is_public boolean not null default true;

-- Preserve existing deployment/repository links on first upgrade only. Clearing
-- a project link later must not cause a subsequent migration to restore it.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demos_project_url_check' and conrelid = 'public.demos'::regclass) then
    update public.demos
    set project_url = coalesce(nullif(btrim(demo_url), ''), nullif(btrim(repo_url), ''))
    where project_url is null
      and length(coalesce(nullif(btrim(demo_url), ''), nullif(btrim(repo_url), ''))) <= 4096
      and coalesce(nullif(btrim(demo_url), ''), nullif(btrim(repo_url), '')) ~* '^https?://[^/@[:space:]]+([/?#]|$)';
    alter table public.demos add constraint demos_project_url_check
      check (project_url is null or (length(project_url) <= 4096 and project_url ~* '^https?://[^/@[:space:]]+([/?#]|$)'));
  end if;
end;
$$;

create or replace function public.set_demo_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists demos_updated_at on public.demos;
create trigger demos_updated_at before update on public.demos
  for each row execute function public.set_demo_updated_at();

alter table public.demos enable row level security;
revoke all on public.demos from anon, authenticated;
grant select on public.demos to anon;
grant select, insert, update, delete on public.demos to authenticated;

drop policy if exists "Public wonder room projects" on public.demos;
create policy "Public wonder room projects" on public.demos for select to anon, authenticated
  using (is_public);
drop policy if exists "Admin wonder room projects" on public.demos;
create policy "Admin wonder room projects" on public.demos for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin' or (auth.jwt()->'app_metadata'->>'is_admin') = 'true');

create index if not exists demos_public_date_idx on public.demos(is_public, date desc, id);
commit;
