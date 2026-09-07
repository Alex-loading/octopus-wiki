## Why

日常收藏分散在 bilibili、抖音、小红书和牛客等平台，缺少跨设备分类和在 octopus-wiki 统一展示的入口。用户确认第一版保存原链接、标题、封面和备注，移动端优先 Android，并为未来 iOS 接入保留统一入口。

## What Changes

- 新增公开收藏箱目录、箱内资源列表和跳转原平台的资源卡片。
- 新增管理员收藏资源和收藏箱管理，收藏时选择或创建分类，支持公开/私密。
- 新增适配手机的收藏表单，接收网址或含链接的分享文案，支持从电脑书签脚本预填。
- 提供可安装的 PWA，在支持 Web Share Target 的 Android 环境接收系统分享；通用粘贴入口可在 Android/iOS 使用，文档说明 iOS 快捷指令接法。
- 对常用平台提供尽力而为的标题和封面解析，失败不阻止手动收藏。
- 新增一次管理员授权后 90 天免登录的本设备收藏能力，可续期或撤销；授权范围仅限收藏采集。

## Capabilities

### New Capabilities
- `cross-platform-bookmark-capture`: 链接提取、平台识别、元信息预填和多端收藏入口。
- `bookmark-library`: 收藏箱、资源、公开展示和管理员管理。

### Modified Capabilities

无。

## Impact

- 复用 React/Vite、Supabase 和现有管理员身份，新增独立收藏数据模块及数据库迁移。
- 路由、导航和登录回跳白名单扩展；保留现有管理员会话仅在标签页 sessionStorage 中保存的约定。
- 增加同源元信息 API、manifest 和 service worker，不引入原生 App 或平台账号同步。
- 完整图文/视频备份、平台原生收藏同步、多用户收藏系统不在本次范围。
