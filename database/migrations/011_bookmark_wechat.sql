-- Add WeChat official account articles to the constrained bookmark platforms.
begin;
alter table public.bookmarks drop constraint if exists bookmarks_platform_check;
alter table public.bookmarks add constraint bookmarks_platform_check
  check (platform in ('bilibili', 'douyin', 'xiaohongshu', 'nowcoder', 'wechat', 'other')) not valid;
alter table public.bookmarks validate constraint bookmarks_platform_check;
commit;
