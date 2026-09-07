-- Scoped collector credentials: server access only; never expose hashes to browsers.
begin;

create table if not exists public.bookmark_capture_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (expires_at > created_at)
);
create index if not exists bookmark_capture_devices_user_idx
  on public.bookmark_capture_devices(user_id);

alter table public.bookmark_capture_devices enable row level security;
revoke all on public.bookmark_capture_devices from public, anon, authenticated;
grant select, insert, update, delete on public.bookmark_capture_devices to service_role;
grant select, insert on public.bookmark_collections, public.bookmarks to service_role;

commit;
