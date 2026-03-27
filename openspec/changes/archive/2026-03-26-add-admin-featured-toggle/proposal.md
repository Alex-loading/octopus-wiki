## Why

当前后台无法直接设置文章是否为精选，运营只能通过数据库手工修改 `featured` 字段，效率低且容易误操作。随着文章数量增加，需要在管理界面提供显式的精选开关以支持日常内容运营。

## What Changes

- 在后台文章列表为每篇文章提供“设为精选/取消精选”操作按钮。
- 仅管理员可执行精选状态变更，未登录或非管理员保持无权限。
- 精选状态变更后，列表立即刷新并反馈成功/失败状态。
- 前台首页继续基于 `featured=true` 展示精选文章，无需改动既有规则。

## Capabilities

### New Capabilities
- `admin-article-featured-management`: 管理员可在后台对文章执行精选与取消精选操作，并获得权限校验与结果反馈。

### Modified Capabilities
- （无）

## Impact

- 受影响前端页面：`src/app/pages/AdminArticles.tsx`。
- 受影响数据访问层：`src/app/content/repository.ts`（新增/扩展文章精选写入方法）。
- 依赖已有数据库字段与 RLS 策略：`public.articles.featured`、管理员写权限策略。
- 不新增外部依赖，不变更公开 API。
