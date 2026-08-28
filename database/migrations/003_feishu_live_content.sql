-- Feishu live-content link and last successful snapshot metadata (idempotent)

alter table if exists public.articles
  add column if not exists feishu_doc_url text,
  add column if not exists feishu_revision_id text,
  add column if not exists feishu_synced_at timestamptz;

comment on column public.articles.feishu_doc_url is
  'Feishu Wiki or Docx URL used for server-side live content refresh';
comment on column public.articles.feishu_revision_id is
  'Revision ID from the last successful Feishu synchronization';
comment on column public.articles.feishu_synced_at is
  'Timestamp of the last successful Feishu synchronization';
