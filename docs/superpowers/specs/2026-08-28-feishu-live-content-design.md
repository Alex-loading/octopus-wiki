# 飞书文档近实时渲染轻量化设计

## 背景

当前工作区中的飞书导入方案要求管理员在浏览器填写飞书与 OBS 凭证，先调用 `/api/configs` 创建 `configId`，再调用 `/api/convert` 获取 Markdown。该方案依赖一个常驻的外部 `feishu2md` 服务，并把运行时配置、密钥与存储配置暴露到管理页面，超出了个人博客所需的内容同步复杂度。

本次优化将它替换为“服务端固定凭证 + 单一无状态内容接口 + CDN 短缓存 + Supabase Markdown 快照兜底”。飞书仍是文章正文的可选上游，现有 Supabase 文章记录和 `ReactMarkdown` 渲染器继续作为存储快照与展示层。

## 目标

- 管理员只需填写飞书 Wiki/Docx URL，不再管理 `configId`、OBS 或飞书密钥。
- 已关联飞书文档的公开文章在访问时拉取最新内容，正常情况下 60 秒内看到飞书更新。
- 保留现有 Markdown 排版、代码高亮、目录、GFM 与安全清洗能力。
- 飞书不可用时继续展示最近一次成功同步的 `content_md`，避免文章页不可用。
- 所有飞书和 Supabase 高权限凭证只存在于服务端环境变量。
- 图片和附件通过签名媒体代理访问，不要求单独部署 OBS。

## 非目标

- 不提供字符级协同编辑或 WebSocket 实时流；“近实时”定义为 CDN 缓存窗口内更新。
- 不嵌入飞书原生云文档组件，也不复刻飞书编辑界面。
- 不实现多套飞书运行时配置、配置列表、配置历史或用户级 OAuth。
- 不在首期深入读取嵌入的 Sheet、Bitable、思维笔记；无法转换的块输出明确占位说明。
- 不改变文章标题、摘要、分类、标签和发布状态的现有管理方式。

## 方案比较与选择

### 方案 A：飞书官方云文档组件

优点是真正实时且完整支持飞书块；缺点是依赖飞书授权、样式不可控、公开访问与 SEO 不符合博客需求。适合内部预览，不作为公开文章正文方案。

### 方案 B：Vercel Serverless 近实时拉取（采用）

用服务端环境变量访问飞书 OpenAPI，把文档块转换为 Markdown，使用 CDN 缓存降低请求频率，并把成功结果写回 Supabase 快照。它保留博客的渲染体验，同时移除常驻转换服务和浏览器配置层。

### 方案 C：CI/Webhook 发布时同步

运行时最稳定，但更新存在流水线延迟，不符合本次“网页访问时自动获得新内容”的目标。未来可作为低频文章的补充同步机制。

## 总体架构

```text
管理后台
  └─ 输入飞书 URL
      └─ POST /api/feishu-content（管理员 JWT）
          └─ 飞书 Wiki/Docx API → Block → Markdown
              └─ 返回预览，沿用现有保存文章流程

公开文章页
  └─ GET /api/feishu-content?slug=<slug>
      ├─ CDN 60 秒缓存命中 → 返回 Markdown
      └─ 缓存未命中
          ├─ 从 Supabase 读取已发布文章及 feishu_doc_url
          ├─ 飞书 Wiki/Docx API → Block → Markdown
          ├─ 成功：写回 content/content_md 快照并返回
          └─ 失败：返回 Supabase 中最近一次 content_md，标记 stale=true

Markdown 图片/附件
  └─ /api/feishu-media?token=...&type=...&sig=...
      └─ 校验 HMAC → 带服务端 token 下载飞书资源 → CDN 长缓存
```

## 服务端组件

### `api/feishu-content.ts`

Vercel Node.js Function，同时支持两种方法：

- `GET ?slug=<slug>`：公开读取。只允许解析 `status=published` 且未软删除的文章。服务端根据文章记录中的 `feishu_doc_url` 拉取内容，客户端不能通过 GET 指定任意飞书 URL。
- `POST`：管理员预览/同步。请求体为 `{ "docUrl": "..." }`，必须携带当前 Supabase access token；服务端验证用户 JWT 中 `app_metadata.role=admin` 或 `app_metadata.is_admin=true`。

统一成功响应：

```json
{
  "success": true,
  "data": {
    "docToken": "...",
    "title": "...",
    "revisionId": "12",
    "markdown": "# ...",
    "stale": false,
    "syncedAt": "2026-08-28T00:00:00.000Z"
  }
}
```

GET 的 CDN 响应头为：

```text
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
```

POST 和错误响应使用 `Cache-Control: no-store`。

### `api/feishu-media.ts`

媒体地址由内容转换服务生成，参数包括 `token`、`type` 和 `sig`。`sig` 使用 `FEISHU_MEDIA_SIGNING_SECRET` 对 `type:token` 做 HMAC-SHA256，防止接口成为任意飞书资源代理。

- `image`、`file` 使用飞书 Drive 媒体下载接口。
- `board` 使用飞书画板图片下载接口。
- 响应透传安全的 `Content-Type` 和二进制内容，不透传飞书鉴权头。
- 成功资源使用一天 CDN 缓存和七天 stale-while-revalidate。
- 签名无效、token/type 不合法时返回 400/403，不请求飞书。

### `api/_lib/feishu.ts`

负责以下单一职责：

- 校验并解析 `*.feishu.cn`、`*.larksuite.com` 下的 `/wiki/{token}` 和 `/docx/{token}` URL；忽略 `from=from_copylink` 等查询参数。
- 使用 `FEISHU_APP_ID`、`FEISHU_APP_SECRET` 获取并在函数实例内缓存 tenant access token，提前 5 分钟刷新。
- Wiki URL 先解析为 `obj_type=docx` 与 `obj_token`；非 Docx 返回 `UNSUPPORTED_DOC_TYPE`。
- 分页获取文档块与最新 revision。
- 对飞书错误做稳定的内部错误码映射，日志中不输出密钥和 access token。

### `api/_lib/markdown.ts`

使用固定版本 `feishu-docx@0.7.0` 的 `MarkdownRenderer` 将飞书 Block JSON 转换为 Markdown，并把 renderer 暴露的媒体 token 替换成签名的 `/api/feishu-media` URL。固定版本与文档 fixture 测试共同隔离上游包更新风险。该模块不负责网络请求，可用固定 fixture 做纯单元测试。

首期保证段落、H1-H3、粗体、斜体、删除线、链接、列表、任务列表、引用、代码块、分隔线、表格、图片、附件和画板可得到 Markdown 或明确占位输出。

### `api/_lib/supabase.ts`

使用 `SUPABASE_SERVICE_ROLE_KEY`，仅向服务端模块暴露以下窄接口：

- 按 slug 读取已发布、未删除文章。
- 成功拉取后按文章 id 更新 `content`、`content_md`、`feishu_revision_id` 与 `feishu_synced_at`。
- 验证 POST 请求携带的 Supabase access token 及管理员 metadata。

Service Role Key 不进入任何 `VITE_` 环境变量或客户端 bundle。

## 数据模型

为 `public.articles` 增加：

```sql
feishu_doc_url text,
feishu_revision_id text,
feishu_synced_at timestamptz
```

约束：

- `feishu_doc_url` 可为空，空值表示普通 Markdown 文章，行为与当前一致。
- `content` 与 `content_md` 始终保存最近一次手工编辑或飞书同步的 Markdown 快照。
- 删除飞书 URL 不删除快照，文章自动回到普通 Markdown 模式。

## 前端改动

### 管理后台

移除：

- 飞书配置弹窗。
- App ID/App Secret 与 OBS 表单。
- API Base、`configId` 及相关 localStorage。
- `/configs` 和旧 `/convert` 客户端封装。

保留一个“飞书文档”区块：

- `feishuDocUrl` 输入框。
- “同步预览并覆盖正文”按钮。
- 点击后调用 POST `/api/feishu-content`；成功时覆盖 `form.content`，同时保留 URL 随文章一起保存。
- 当正文已有未保存改动时，点击按钮前沿用浏览器确认，避免误覆盖。

### 数据访问层

`Post` 和文章写入模型增加可选字段：

```ts
feishuDocUrl?: string;
feishuRevisionId?: string;
feishuSyncedAt?: string;
```

`getArticleBySlug` 先读取 Supabase 文章。若存在 `feishuDocUrl`，再请求 GET `/api/feishu-content?slug=...` 并用返回 Markdown 覆盖内存中的 `post.content`；任何网络或 API 错误都保留数据库快照，不让文章页进入错误态。

### Markdown 渲染

继续使用现有 `ReactMarkdown → remark-gfm → rehype-slug → rehype-autolink-headings → rehype-sanitize` 链路，不引入第二套网页渲染器。

## 错误处理与降级

- 环境变量缺失：服务端返回 `SERVER_NOT_CONFIGURED`；GET 若有快照则返回快照并标记 `stale=true`。
- URL 不合法：管理后台显示 `INVALID_DOCUMENT_URL`，不覆盖正文。
- Wiki 不是 Docx：返回 `UNSUPPORTED_DOC_TYPE`。
- 飞书无权限或 token 失败：POST 展示明确错误；GET 返回快照。
- Markdown 转换失败：不更新数据库快照。
- Supabase 快照更新失败：仍返回刚转换的 Markdown，但记录不含敏感信息的服务端错误。
- 飞书失败且文章无快照：GET 返回 502，文章页沿用其已经读取到的空内容并显示普通加载失败提示。

## 安全设计

- 浏览器永远接触不到飞书 App Secret、tenant access token、Supabase Service Role Key。
- POST 预览必须验证 Supabase 管理员身份。
- GET 只接收 slug，不接受外部 URL，避免公开 SSRF/文档枚举入口。
- 飞书 URL 只允许 HTTPS 和受支持的飞书/Lark 域名与路径。
- 媒体代理必须验证 HMAC；日志不记录签名、密钥和 token 全文。
- Markdown 继续由 `rehype-sanitize` 清洗，外链继续使用 `noopener noreferrer`。

## 环境变量

服务端：

```text
FEISHU_APP_ID
FEISHU_APP_SECRET
FEISHU_MEDIA_SIGNING_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

现有客户端变量 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY` 保留。删除不再使用的 `VITE_FEISHU_TOOL_API_BASE`。

## 测试策略

项目继续使用已有 `tsx`，新增 Node 原生 test runner 脚本，不额外引入测试框架：

```text
tsx --test tests/**/*.test.ts
```

测试分层：

- URL 解析：Docx、Wiki、复制链接查询参数、非法域名、非法协议与非法路径。
- token 缓存：有效缓存复用、临近过期刷新、飞书鉴权错误映射。
- Wiki/Docx 拉取：Wiki 解析、非 Docx 拒绝、Block 分页合并。
- Markdown：核心块 fixture、媒体 URL 重写和不支持块占位。
- 媒体签名：正确签名、篡改 token/type、非法类型。
- 内容 handler：公开文章、管理员预览、非管理员拒绝、飞书失败回退快照、成功写回快照、缓存头。
- 前端 repository：有飞书 URL 时采用最新内容，实时接口失败时保留 Supabase 快照。
- 回归：`npm test`、`npm run build`、`git diff --check`。

## 迁移与回滚

迁移顺序：

1. 添加数据库 nullable 字段，不影响现有文章。
2. 部署 Serverless 函数和环境变量。
3. 将后台导入区替换为 URL + 同步预览。
4. 文章读取接入近实时接口。
5. 删除旧 configId/API Base/OBS UI 与旧客户端封装。

回滚时关闭前端近实时请求即可；`content_md` 快照仍可被现有文章页读取，新增 nullable 字段无需立即删除。

## 验收标准

- 不启动本地 `feishu2md` 服务时，配置好服务端环境变量即可同步飞书文档。
- 管理页面和浏览器存储中不再出现飞书/OBS 密钥、configId 或 API Base 配置。
- 飞书文档更新后，公开文章在 CDN 缓存窗口后展示新内容。
- 飞书 API 人为不可用时，公开文章仍展示最近一次快照。
- 非管理员无法通过 POST 抓取任意飞书 URL。
- 篡改后的媒体 URL 无法读取飞书资源。
- 普通非飞书文章的创建、编辑、发布和阅读行为保持不变。
