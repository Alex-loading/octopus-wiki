## Context

站点是 React 18/Vite SPA，Root 按路径分发页面，Vercel Functions 承担同源服务端能力。Supabase 的 `app_metadata.role=admin` / `is_admin=true` 和数据库 RLS 管理权限；管理员会话只保存在当前标签页 sessionStorage。工作区已有其他未提交的文章功能，修改应保持独立且不覆盖已有工作。

用户确认：Android 优先、未来可支持 iOS；只保存原链接、标题、封面和备注，不备份原文。

## Goals / Non-Goals

**Goals:** 电脑/手机统一收藏、即时分类和建箱、公开目录及资源跳转、管理员完整增改删和移动、解析失败可保存。

**Non-Goals:** 同步平台原生收藏、完整图文/视频备份、多用户产品、原生 App、离线写入队列。

## Decisions

### 页面和采集路径

公开 `/collections` 展示收藏箱，`/collections/:id` 展示资源并支持搜索/平台筛选。管理员 `/admin/bookmarks` 管理资源与分类；`/collect` 是手机优先的共享表单，接受 `url/title/text/cover` 查询参数。创建收藏前必须验证管理员身份或受限的本设备收藏授权，GET 仅预填，不创建记录。

电脑书签脚本读取当前页面 URL、标题和 og:image，打开固定名称的收藏窗口；也支持手动粘贴。Android 安装 PWA 后通过 Web Share Target 将分享内容交给 `/collect`，默认 GET 仅预填表单。提供独立入口说明页 `/collect/setup`，包含书签脚本和 Android/iOS 使用说明。iOS 可把快捷指令接收到的文本 URL 编码后打开 `/collect?text=...`，不要求与 Android 共用系统分享实现。

比较方案：纯网页最轻但切换操作较多；PWA + 书签脚本复用现有站点且具备 Android 分享能力；扩展 + 原生 App 可更深入集成但维护成本偏高。本次采用第二种。

### 数据与可见性

- `bookmark_collections`: UUID、名称（去空格后不区分大小写唯一）、说明、is_public、sort_order、创建/更新时间。
- `bookmarks`: UUID、collection_id、url（保留原链接）、canonical_url（保守规范化去重键）、title、cover_url、note、platform、is_public、创建/更新时间。
- 第一版一个资源属于一个箱；管理员可移动。相同去重键再次收藏提示已有记录，用户可到后台编辑，不默默覆盖。
- 公开查询只读取同时满足“箱公开”和“资源公开”的记录；私密箱名称、记录和计数不泄露给游客。RLS 作为最终权限边界，普通登录账号无写权限。
- 有内容的箱禁止直接删除，先移动/删除资源，避免误删整箱。

### 链接与元信息

接收 HTTP(S) URL 和带短链接的分享文案；多个链接时让用户选择。按域名识别四个平台，其他站点归入“其他”。仅删除明确的跟踪参数，保留访问令牌、资源参数和片段；不以“去掉全部 query”的方式去重。原链接始终保留。

`POST /api/bookmark-preview` 验证管理员 token 后，仅请求明确允许的常用平台主机，逐跳验证重定向，限制时间、响应大小及 HTML 类型。读取 title、og:title、og:image；不执行脚本，不处理登录验证码。未知站点仍能手动保存。用户已有输入不被异步解析结果覆盖。

### 会话与错误

复用当前标签页管理员会话策略，不把管理员凭证塞进书签脚本或分享 URL。扩展登录返回路径白名单，登录链接带上原收藏预填参数。未登录、无权限、空状态、请求失败、重复收藏和缺少数据库配置均给出实际状态，不展示伪造收藏。

### 本设备免登录收藏（后续需求）

用户实际使用发现新收藏窗口反复要求登录。采用独立的设备授权，管理员首次点击启用后签发 90 天随机凭证；不改变全站管理员会话的存储方式。凭证放在 HttpOnly、SameSite=Lax、生产 Secure、host-only Cookie 中，路径为 `/api/collector`，数据库 `bookmark_capture_devices` 仅存 SHA-256 摘要、签发用户、期限和撤销时间，浏览器角色无表权限。

`/api/collector` 每次检查凭证状态及用户当前 app_metadata 管理员角色。仅提供收藏箱列表、新建收藏箱、新建收藏和预览，不提供已有资源读取/修改/删除。写操作严格校验同源 Origin、JSON 类型及大小、输入类型与字段白名单；服务端使用 service_role 执行限定操作。无有效授权的 GET 不返回任何私密箱信息；GET 不签发授权或保存资源。

收藏页先检查设备授权；无管理员会话但设备有效时直接使用受限 API。已有管理员会话可继续直接收藏，并可显式启用设备授权。启用/续期和撤销所有设备要求当前管理员凭证；本设备可自行撤销。续期轮换随机值，旧值立即失效。退出管理员登录不撤销此授权，界面明确说明。跨浏览器/PWA 不共享 Cookie 时需分别启用；到期后保留当前表单输入，可在新标签页重新授权后重试。

### PWA 与视觉

manifest 以 `/collect` 为应用身份和启动页，scope 为站点根路径，以覆盖 `/admin/login` 登录回调；配置分享目标和本地图标。service worker 不缓存管理员数据、鉴权请求或 API，也不宣称支持离线保存。静态离线提示要求联网后重试。收藏页延续站点靛蓝、灰阶、明暗主题和像素章鱼风格，用收藏箱轮廓、数量和资源网格区分层级，手机表单单列。

## Risks / Trade-offs

- 平台反爬/登录/短链变更 → 解析尽力而为，手填是完整可用路径；四个平台须真实设备验收后才能宣称全部解析可用。
- 封面外链失效或防盗链 → 本地占位，不阻断打开原文；本次不下载或托管封面。
- Web Share Target 支持不一致 → 仅在支持的已安装 Android PWA 使用，所有设备可粘贴；iOS 快捷指令单独接入。
- 跨窗口登录 → 使用可撤销的 90 天设备收藏授权；只对收藏新增操作开放。浏览器清理 Cookie 后需重新启用，不宣称不同浏览器共享授权。
- 规范化无法穷尽平台短链映射 → 相同规范化 URL 去重；不同短链指向同一内容暂不保证合并。

## Migration Plan

新增独立迁移，不改文章表；先在测试 PostgreSQL 验证约束和 RLS，再运行应用测试/构建。上线时对配置的目标库应用新迁移，Vercel 发布静态文件和新 API；真实设备执行 Android 分享、登录后预填保留、分类保存和公开展示验收。回退应用版本可保留收藏表和数据，禁用 manifest/service worker 入口；不自动删表。

## Open Questions

无需阻断实现的产品问题。正式 Android 浏览器/应用版本以及生产数据库、部署和设备测试在交付时明确记录实际验证范围。

## References

- https://developer.chrome.com/docs/capabilities/web-apis/web-share-target
- https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target
- https://support.apple.com/guide/shortcuts/launch-a-shortcut-from-another-app-apd163eb9f95/ios
