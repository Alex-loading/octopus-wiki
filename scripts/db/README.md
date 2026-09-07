# 数据库初始化与迁移

## 收藏箱迁移

收藏功能新增 `database/migrations/007_bookmarks.sql`，创建独立的 `bookmark_collections` 和 `bookmarks` 表；`008_bookmark_capture_devices.sql` 创建仅服务端可访问的设备授权表。不修改文章数据。已运行 007 的环境仅补 008。

在测试库以 owner 身份执行 `scripts/db/verify-bookmarks.sql` 验证游客、普通账号、伪造用户元数据、两类管理员声明、去重约束、移动资源和禁止删除非空收藏箱。测试使用独立事务，最后回滚。应用端也兼容 PostgreSQL 对删除限制返回的 `23503` 与 `23001` 错误码。

完整配置见 [收藏箱使用与部署](../../docs/plans/2026-09-07-bookmark-library.md)。

`scripts/db/verify-collector-devices.sql` 验证授权表拒绝游客及管理员浏览器角色读取/写入、服务端查询与撤销、摘要和唯一约束、私密收藏写入及删除账号后的授权清理。以测试库 owner 身份运行，最后回滚。

## 1) 初始化（可重复执行）

你可以选两种方式执行初始化：

### 方式 A：命令行一键初始化（推荐）

1. 准备 `DATABASE_URL`（可使用 Supabase 的连接串）。
2. 执行：

```bash
npm run db:init
```

3. 幂等验证（连续执行两次）：

```bash
npm run db:verify
```

4. 管理员权限与关键写入场景验证：

```bash
npm run db:verify-admin
```

### 方式 B：Supabase SQL Editor 手工执行

按顺序执行以下脚本：

- `database/migrations/001_content_schema.sql`
- `database/migrations/002_article_admin_auth.sql`
- `database/migrations/003_feishu_live_content.sql`
- `database/migrations/004_article_interactions.sql`
- `database/migrations/005_admin_comment_deletion.sql`
- `database/migrations/006_article_author.sql`

脚本使用幂等写法（`if not exists` / `drop policy if exists`），可重复执行。

### 已有项目升级作者签名与头像

作者功能只需在已有文章表的基础上，在 SQL Editor 完整执行 `006_article_author.sql`，再使用新版网页。
新增 `articles.author_name`（可空、最多 40 字）和 `author_avatar`（内置头像标识）。
原有文章自动显示 Octopus + 日常章鱼，不覆盖正文或修改权限。新建/编辑可自定义签名和头像，重新同步飞书不会覆盖署名。
这是新增列迁移，必须先执行迁移再部署依赖这两个字段的前端。

验证：

```sql
select id, author_name, author_avatar from public.articles limit 5;
```

随后在后台保存一篇自定义签名和头像的文章，重新编辑确认回填，并在已发布文章详情确认显示。
留空签名、保存后刷新应显示 Octopus。CLI 的 `db:init` 读取根目录 `.env` 的 `DATABASE_URL`，不是 `.env.local`。

## 2) 本地验证建议

- 首次执行后，确认表存在：`articles`、`demos`、`article_demos`、`article_likes`、`article_comments`
- 确认 `articles` 含 `deleted_at`、`updated_by`、`like_count` 字段
- 确认 `articles` 已启用 RLS，并存在 admin 写策略
- 确认匿名角色只能读取/新增评论，不能直接读取 `article_likes`，并可执行点赞 RPC
- 确认普通登录用户也不能删除评论；只有管理员可以删除任意评论（包括历史评论）
- 再执行一次同一脚本，确认无报错（幂等）
- 可插入一条 `articles` 的 `published` 记录，验证前端读取链路

## 3) 管理员角色约定

后台管理使用 Supabase JWT 的 `app_metadata` 作为管理员来源，满足任一条件即视为管理员：

- `app_metadata.role = "admin"`
- `app_metadata.is_admin = true`

在 Supabase Auth 中可通过 Admin API 更新用户元数据。

### 管理员删除评论

如果已执行 `001`–`004`，在 Supabase SQL Editor 中完整执行 `database/migrations/005_admin_comment_deletion.sql` 即可。迁移只调整删除权限，不删除或回填任何评论，也不修改匿名评论体验。

管理员在当前已登录的页面中通过站内导航进入文章，在评论下方点击“删除”，确认后永久删除该评论。失败时保留评论并显示错误，成功后更新列表与数量。普通用户（包括评论作者）没有删除入口，直接请求删除也会被数据库权限/RLS 拦截。

管理员身份复用全站共享登录态，不信任可由用户编辑的 `user_metadata`。会话保存在当前标签页的 `sessionStorage`，刷新保留登录；不写入 `localStorage`。存储不可用时退回内存，会话不跨刷新。顶栏管理员章鱼可退出当前会话，评论删除入口同步隐藏。

权限验证：在测试数据库的 SQL Editor 中执行 `scripts/db/verify-comment-deletion.sql`。脚本生成独立测试文章/评论，验证游客、普通账号、伪造用户元数据和两种管理员声明，最后回滚，不保留测试数据。验证真实页面时，只使用专门创建的测试评论，不删除已有真实评论。

## 4) 回滚

如需回滚，可手动执行：

```sql
drop table if exists public.article_demos;
drop table if exists public.demos;
drop table if exists public.articles;
```
