-- Content schema migration (idempotent)

create extension if not exists pgcrypto;

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null default '',
  content_md text not null default '',
  content text not null default '',
  cover_image text,
  tags text[] not null default '{}',
  category text not null default '未分类',
  read_time integer not null default 1,
  featured boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_articles_status_published_at on public.articles(status, published_at desc);
create index if not exists idx_articles_category on public.articles(category);

create table if not exists public.demos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null default '',
  long_description text not null default '',
  category text not null default '工具',
  tags text[] not null default '{}',
  tech_stack text[] not null default '{}',
  status text not null default 'planned' check (status in ('live', 'wip', 'planned')),
  colors text[] not null default '{#64748b,#475569}',
  icon text not null default '✦',
  demo_url text,
  repo_url text,
  date text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_demos_status on public.demos(status);
create index if not exists idx_demos_category on public.demos(category);

create table if not exists public.article_demos (
  article_id uuid not null references public.articles(id) on delete cascade,
  demo_id uuid not null references public.demos(id) on delete cascade,
  order_index integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (article_id, demo_id)
);

create index if not exists idx_article_demos_article_order on public.article_demos(article_id, order_index);
