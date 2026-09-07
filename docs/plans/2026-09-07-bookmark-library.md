# 跨平台收藏箱使用与部署

保存原链接、标题、可选封面链接和备注；Android 优先，iOS 可通过粘贴或手工配置快捷指令接入。不备份原文、图片文件或视频，不同步平台原生收藏。

## 页面与规则

| 路径 | 用途 |
| --- | --- |
| `/collections` | 公开收藏箱与最近收藏 |
| `/collections/:id` | 箱内资源，支持搜索/平台筛选，点击打开原平台 |
| `/collect` | 收藏入口，支持本设备免登录、分享文本、选箱和即时建箱 |
| `/admin/bookmarks` | 编辑、移动、删除资源，管理收藏箱及公开状态 |
| `/collect/setup` | 电脑书签脚本、Android 安装与 iOS 接入说明 |

收藏箱和资源同时公开才会出现在公开页。新建时默认勾选公开，可取消。有内容的收藏箱不能直接删除，先移动或删除资源。

## 部署

1. 沿用 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY` 和已有管理员账号。
2. 在目标 Supabase 数据库依次应用 `database/migrations/007_bookmarks.sql` 和 `database/migrations/008_bookmark_capture_devices.sql`。已运行 007 的环境仅补 008。本次开发验证未连接线上数据库。
3. 元信息和免登录收藏 API 沿用服务端 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`，不要使用 `VITE_` 前缀。不需要平台 Cookie 或额外平台 API Key。
4. Supabase Authentication → URL Configuration：Site URL 设置为 `https://octopus-wiki.vercel.app`，Redirect URLs 添加 `https://octopus-wiki.vercel.app/admin/login**`，保留本地 `http://localhost:3000/admin/login**`。收藏内容通过 `next` 返回，外站回跳会被拒绝。Magic Link 邮件使用 `{{ .ConfirmationURL }}`；修正配置后从线上重新发送邮件，旧邮件不会自动更新地址。
5. 构建并部署到 Vercel，确认 `/api/collector`、`/api/bookmark-preview`、`/manifest.webmanifest`、`/collector-sw.js` 和两种 PNG 图标可访问。生产必须使用 HTTPS。`GET /api/collector` 无授权时返回 `authorized: false`；管理员启用授权可检查服务端配置和迁移是否完整。

`npm run dev` 只运行前端。真实收藏授权和元信息 API 联调使用 `npx vercel dev`。开发模式不注册 service worker，生产构建（含 `vite preview`）才会注册。

## 使用

电脑：打开 `/collect/setup`，首次登录管理员账号后点击「启用 90 天免登录收藏」，再将「收藏到 Octopus」拖到书签栏。以后浏览资源时点击，核对标题、选箱并保存。原有书签按钮无需更换。页面限制书签脚本时，复制链接后在 `/collect` 粘贴。

Android：通过支持 Web Share Target 的浏览器安装 Octopus 收藏箱，再从原 App 的系统分享菜单选择它。若 App 仅显示自己的分享面板，找「更多」或复制分享文案后粘贴。创建桌面网页快捷方式不等于注册系统分享目标。

iOS：网页粘贴可直接使用。`/collect/setup` 说明如何让快捷指令接收 URL/文本、URL 编码后打开 `/collect?text=...`。本次未创建、安装或在 iPhone 上验证快捷指令。

标题与封面读取只补全空白字段，不覆盖手动输入。平台限制抓取时可手填保存；其他网站可手动收藏。封面使用原图片外链，失效时显示平台占位，不影响打开原链接。

相同规范化 URL 会提示重复，原链接及其访问令牌仍保留。不同短链接指向同一资源时暂不保证合并。没有离线写入队列，失败不会显示保存成功，已打开表单中的输入会保留。

## 免登录收藏授权

管理员会话继续保存在当前标签页 sessionStorage；收藏使用独立的 90 天设备授权。同一站点、同一浏览器配置中的新标签页或关闭后重新打开的窗口可继续收藏；更换浏览器、无痕窗口、清除站点数据后需重新启用。浏览器和 PWA 若不共享 Cookie，也需分别启用。浏览器可能因隐私/存储策略提前清理授权。

授权仅允许读取收藏箱供选择（包括私密箱的名称与说明）、新增收藏箱、新增资源和读取标题封面。不能读取私密资源列表，不能编辑、移动或删除已有记录，也不能管理文章或签发新授权。管理员未启用免登录时，当前已登录标签页仍可使用原有收藏功能。

设置页和收藏页支持「关闭本设备免登录」；登录管理员后可续期、撤销此账号所有设备授权。退出管理员账号不会撤销设备授权。授权到期、被撤销或签发者不再是管理员时，后续请求失效；打开中的表单保留输入，可以在另一个标签页登录并重新启用，再返回原表单重试。

服务端使用 32 字节随机凭证，仅在 HttpOnly、SameSite=Lax、HTTPS Secure 的持久 Cookie 中返回，路径为 `/api/collector`，不写进书签脚本、分享 URL 或 localStorage。数据库只保存 SHA-256 摘要，浏览器角色无权访问授权表。API 每次检查到期、撤销状态及签发者当前管理员身份；所有写操作校验同源 Origin。该机制不授予全站管理员登录状态。

## 验证

- 应用测试：`node --import tsx --test tests/**/*.test.ts`。测试内容与 npm test 相同，避免受限环境中 tsx CLI 的 IPC 管道问题。
- 构建：`npm run build`。
- 数据库：在已应用迁移的测试库，以 owner 身份执行 `scripts/db/verify-bookmarks.sql` 和 `scripts/db/verify-collector-devices.sql`；事务内样例最后回滚，不要把测试脚本当作生产迁移。
- 已用临时 PGlite 0.5.8 / PostgreSQL 18.3 重复应用迁移并执行 RLS/约束测试。浏览器验证使用独立内存示例数据，未写入真实收藏。
- 待实际环境验收：Android 真机安装/分享、各平台真实短链和封面、邮件登录跨 App 回调，以及线上 API 部署。

## 参考

- [Chrome Web Share Target](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target)
- [MDN share_target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target)
- [Apple 快捷指令共享表单](https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios)
- [MDN Set-Cookie](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [Supabase 服务端读取用户](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid)
