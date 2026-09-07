# 移动端分享链接的标题与封面

## 实际原因

小红书示例 `/discovery/item/6a9a92dc000000000d0246f6` 的分享 HTML 包含两条 `og:image`：前一条是站点标识，后一条是真实笔记封面。真实封面使用 `http://sns-webpic-qc.xhscdn.com/...`，页面同时声明 `upgrade-insecure-requests`。旧解析器选中了真实封面，却在只接受 HTTPS 的检查中将其丢弃。将同一地址升级到 HTTPS 后，真实 HEAD 请求返回 200、`image/jpeg`。此前记录的“未提供可用封面”应理解为解析器未接受返回的 HTTP 地址，不是平台未提供封面。

抖音示例 `https://v.douyin.com/728lgXkTLvg/` 跳转到视频 `7681983811227372425`。普通服务端请求最终得到 72,914 字符的 HTML，只有 charset meta。保留分享参数、请求公开移动页仍只得到通用标题和页面状态，没有视频内容。全新、未登录的 Chrome 执行页面脚本后，出现了真实标题及 `lark:url:video_cover_image_url`。原因是原服务端只下载 HTML，没有执行页面脚本；仅增加 meta 名称解析不能解决移动分享路径。

## 实现

- 仅将小红书 `*.xhscdn.com` 上不带非默认端口的 HTTP 封面升级为 HTTPS，保留原路径和参数；仍拒绝其他 HTTP 图片和带账号信息的 URL。
- 抖音视频初始 HTML 缺少标题或封面时，使用独立 Chromium 渲染其规范视频页。只读取两个 `lark` 标签，不保存整页、视频或用户登录数据。
- 浏览器限于明确的视频地址及平台脚本/API 域名；阻止图片、音视频、字体及任意主机请求。限定启动和读取时间，完成或失败后关闭进程；单个函数实例同时只运行一个浏览器。进程不继承 Supabase、飞书密钥。
- 普通页面或已有完整元数据的抖音页面继续直接解析 HTML。预览接口仍先校验管理员/设备权限。
- 新收藏通过系统分享带入的标题属于预填内容，可以被读取结果替换；手动编辑过的标题和已有收藏的标题继续受保护。
- 使用 Node.js 24、固定版本 `@sparticuz/chromium` 149.0.0 与 `puppeteer-core` 25.10.0。Vercel 两个相关接口包含 Chromium 二进制，最大执行时间 60 秒。本地 macOS 默认使用已安装 Chrome 的全新临时配置，也支持显式指定本地执行文件。

## 验证

新增回归测试先复现 HTTP 封面被丢弃、抖音静态 HTML 不触发渲染、系统分享标题不被更新的问题，再实现修复。另验证浏览器请求限制、短链跳转检查和不必要渲染的跳过。

修改后的真实 `fetchBookmarkPreview` 已在本地读取用户两条链接，均返回正确标题与封面；没有依赖分享文案生成服务器标题，也没有写入测试收藏。生产环境验证见后续发布记录。

Node.js 24 下完整测试 124/124 通过，API 类型检查与生产构建通过。旧 Markdown 测试改用与应用一致的 Vite 模块加载，解决 Node.js 24 直接导入其语法高亮依赖时的导出兼容问题；Markdown 组件本身未变更。

## 参考

- [Chrome Headless](https://developer.chrome.com/docs/automation-and-testing/headless)
- [Sparticuz Chromium](https://github.com/Sparticuz/chromium)
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations)
