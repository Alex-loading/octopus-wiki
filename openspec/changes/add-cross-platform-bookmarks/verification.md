# 验证记录 · 2026-09-07

## 已完成

- `node --import tsx --test tests/**/*.test.ts`：103/103 通过，无跳过；收藏功能新增 30 项测试，另追加线上 Magic Link 回调与收藏预填保留回归测试。
- `npm run build`：通过。产物主 JS 约 1.74 MB，Vite 提示超过 500 kB 分块建议；本次未改动全站分包结构。
- `git diff --check`：通过。
- `openspec validate add-cross-platform-bookmarks --strict`：通过，12/12 实现任务完成。
- PostgreSQL 18.3 / PGlite 0.5.8：在独立内存库模拟 Supabase 的 anon/authenticated 角色和 auth.jwt，迁移连续执行两次成功；执行 `scripts/db/verify-bookmarks.sql` 验证公开/私密、游客及普通账号禁止写入、用户元数据伪造、两类管理员角色、重复链接与箱名、非法 URL、资源移动、非空箱删除、回滚后无残留数据。
- 浏览器：使用临时内存示例数据检查桌面收藏箱目录、进入箱内、390px 手机表单、保存成功、后台显示新资源、移动到其他箱；检查手机深色主题。临时页面与数据已删除。

## 免登录收藏追加验证

- API：管理员才可签发/续期/撤销所有设备；32 字节随机值、Cookie 属性、90 天期限和 SHA-256 存储；无管理员 JWT 的设备收藏；缺少/篡改/到期/撤销的 Cookie 拒绝；用户角色实时降权；跨站或缺失 Origin 拒绝；不允许改删或签发权限；输入校验、写入字段白名单；服务失败不误清除 Cookie。
- 前端：未授权时登录链接保留分享参数；设备授权时不直接查询 Supabase 私密数据、不携带管理员 JWT；即时建箱并保存；过期写入保留草稿，重新授权后可重试；管理员启用时保留已有输入，以及设备撤销。
- SQL：PGlite / PostgreSQL 18.3 连续两次应用 007 与 008，再运行两个验证脚本成功。验证授权表拒绝所有浏览器角色读取和写入、服务端查询/撤销/收藏、摘要和唯一约束、删除账号级联清理。测试回滚后无授权残留。
- 浏览器实际 Cookie 流程：独立 localhost 测试服务使用真实 collector handler 和前端，数据与管理员身份为隔离内存替身。启用后关闭原窗口，新窗口无管理员会话仍识别设备授权，成功建箱和收藏；关闭本设备授权后恢复首次登录入口。临时页面、服务和数据已清理。
- 上述浏览器验证使用本地 HTTP Cookie；生产 HTTPS 的 Secure 属性由 API 自动化测试验证，托管 Supabase 与生产浏览器仍需部署后联调。

## 修复并覆盖的回归

- 页面退出动画期间，收藏页不得再次重定向登录并丢失原分享参数。
- 编辑从关联查询取得的资源时，只提交可编辑字段，不把关联表元数据提交给 PostgREST。
- 自动预览晚返回时，不覆盖用户已经手填的标题。
- PostgreSQL 删除限制的 23503 / 23001 均映射成可理解的非空收藏箱提示。
- 已登录管理员访问公开页面时，查询仍明确要求箱和资源同时公开。

## 线上配置核对 · 2026-09-07

- Supabase 原 Site URL 为 `http://localhost:3000`，Redirect URLs 只有本地登录路径；已通过桌面 Chrome 改为生产 Site URL `https://octopus-wiki.vercel.app` 并添加 `https://octopus-wiki.vercel.app/admin/login**`，保留本地条目。
- 使用故意无效的测试 token 请求公开 Auth 验证端点（不发送邮件、不登录账号），验证实际 303 回跳为生产 `/admin/login?next=%2Fcollect%2Fsetup`，参数完整保留。
- Supabase HTTPS Data API 检查当前文章、评论、点赞、收藏箱、资源、设备授权表及新文章字段均可访问，因此未重复执行迁移、未写入测试记录。
- 用户明确授权后，将现有 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_MEDIA_SIGNING_SECRET` 补充到指定 Vercel 项目的 Production 加密环境变量；无密钥进入源码。

## 验证边界

- 数据库迁移未由本次任务执行；线上表和字段已存在。未创建任何真实收藏。
- 元信息 API 的自动化验证使用受控 HTTP 响应；未使用真实四平台资源验证抓取成功率。
- Android 真机 PWA 安装和系统分享、跨 App 邮件登录回调、iOS 快捷指令尚未真机验证。
- PGlite 检查 PostgreSQL SQL/RLS 语义，不替代 Supabase 托管环境与真实 JWT 登录的联调。
- 现有 npm test 的 tsx CLI 在沙箱中因 IPC socket EPERM 无法启动；使用相同 tsx loader 的 Node test 命令完整运行所有测试。

部署及使用步骤见 `docs/plans/2026-09-07-bookmark-library.md`。
