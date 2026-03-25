# 数据库初始化与迁移

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

脚本使用幂等写法（`if not exists` / `drop policy if exists`），可重复执行。

## 2) 本地验证建议

- 首次执行后，确认表存在：`articles`、`demos`、`article_demos`
- 确认 `articles` 含 `deleted_at`、`updated_by` 字段
- 确认 `articles` 已启用 RLS，并存在 admin 写策略
- 再执行一次同一脚本，确认无报错（幂等）
- 可插入一条 `articles` 的 `published` 记录，验证前端读取链路

## 3) 管理员角色约定

后台管理使用 Supabase JWT 的 `app_metadata` 作为管理员来源，满足任一条件即视为管理员：

- `app_metadata.role = "admin"`
- `app_metadata.is_admin = true`

在 Supabase Auth 中可通过 Admin API 更新用户元数据。

## 4) 回滚

如需回滚，可手动执行：

```sql
drop table if exists public.article_demos;
drop table if exists public.demos;
drop table if exists public.articles;
```
