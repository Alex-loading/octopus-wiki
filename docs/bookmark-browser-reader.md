# 平台内容读取与登录恢复

bilibili、抖音、小红书、牛客和微信公众号共用浏览器读取服务。公共 HTML 提供实际标题时直接读取；登录重定向、需要浏览器执行的页面、平台默认标题和部分访问拦截会进入持久 Chrome。小红书直接使用浏览器读取笔记状态。

浏览器使用独立的 `userDataDir` 保存 Cookie 和平台登录状态。登录操作与内容读取使用同一个 Chrome 数据目录，各网站的 Cookie 由浏览器按域名管理。分享链接及其中的内容参数完整保留。

## 收藏页面操作

1. 点击“读取剪贴板并识别信息”。
2. 需要登录或验证时，页面显示具体原因和“打开平台页面并继续读取”。
3. 点击按钮，在独立 Chrome 或远程浏览器页签中完成平台要求的操作。
4. 服务在后台页面重新访问原链接，取得实际内容后更新标题和封面。

管理员收藏和设备授权收藏使用相同流程。手动编辑的标题、已有封面与其他表单内容保持原值。修改链接、取消等待或关闭表单会终止对应的检查；过期请求的结果无法填入新链接。登录等待最长 10 分钟，每次检查结束后间隔 4 秒进行下一次检查，请求不会重叠。

关闭登录窗口不能证明登录成功。服务会重新访问原链接，校验平台、内容标识、标题和封面。主页标题、登录页面默认信息和其他内容的标题无法通过校验。关闭页面且原内容仍然不可访问时，返回 `LOGIN_WINDOW_CLOSED`。

## 本地运行

需要 Node.js 24 和已安装的 Google Chrome。macOS 默认路径为 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`，其他系统需要配置 `BOOKMARK_CHROME_EXECUTABLE_PATH`。

```bash
nvm use
npm run bookmarks:reader
```

另一个终端运行 `npm run dev`。读取服务默认地址为 `http://127.0.0.1:4318`，网站 API 自动读取本地令牌文件。首次平台登录可直接从收藏页面发起。

服务默认启动 headless Chrome。用户点击登录操作时，服务正常关闭浏览器并用同一数据目录启动可见 Chrome，已经保存的登录状态继续使用。后续读取页面在后台打开，登录页面保持可操作。同一数据目录只能同时运行一个 Chrome 进程。

也可以在启动时打开指定平台的登录入口：

```bash
npm run bookmarks:reader:login -- --platform bilibili
npm run bookmarks:reader:login -- --platform douyin
npm run bookmarks:reader:login -- --platform xiaohongshu
npm run bookmarks:reader:login -- --platform nowcoder
npm run bookmarks:reader:login -- --platform wechat
```

这些命令任选需要的平台，运行前使用 `Ctrl+C` 正常停止已有服务。通过收藏页面发起登录时，会直接打开需要收藏的原链接，以呈现该内容所要求的登录或验证。

```bash
npm run bookmarks:reader -- status
```

`connected` 表示浏览器连接正常，`reading` 表示正在处理读取或打开操作，`loginPending` 表示等待用户操作，`headed` 表示 Chrome 有可见窗口。平台是否允许访问，以原内容读取结果为准。

## 配置

| 配置 | 用途 |
| --- | --- |
| `BOOKMARK_BROWSER_DATA_DIR` | 浏览器数据与令牌目录，默认 `.local/bookmark-reader` |
| `BOOKMARK_BROWSER_READER_HOST` | 监听地址，默认 `127.0.0.1` |
| `BOOKMARK_BROWSER_READER_PORT` | 端口，默认 `4318` |
| `BOOKMARK_BROWSER_READER_URL` | 网站 API 连接读取服务的根地址 |
| `BOOKMARK_BROWSER_READER_TOKEN` | 两端一致、至少 32 个字符的服务令牌 |
| `BOOKMARK_CHROME_EXECUTABLE_PATH` | Chrome executable 路径 |
| `BOOKMARK_BROWSER_LOGIN_URL` | 读取主机上同一 Chrome 所在桌面的远程操作页面，要求 HTTPS |

默认数据目录已加入 `.gitignore`，首次启动生成权限为 `0600` 的令牌文件。浏览器仅接收运行所需的环境变量。网络访问按平台限定页面、认证与资源域名，拒绝未知页面、非法端口、账号密码和跨平台跳转。

## 远程部署

读取服务需要运行在具有持久目录、Chrome 和可交互桌面的常驻主机上。使用已有的远程桌面网页入口，例如 noVNC，并将读取服务的 `DISPLAY` 指向该桌面。远程入口需要验证用户身份。

在读取主机配置 `BOOKMARK_BROWSER_LOGIN_URL`，指向该桌面的 HTTPS 操作页面。收藏页面会通过用户点击打开此入口，同时让同一主机中的 Chrome 打开原链接。网站普通页签中的平台登录状态由用户自己的浏览器保存；读取服务需要在远程操作页面中的 Chrome 完成登录。

在网站服务端配置：

```dotenv
BOOKMARK_BROWSER_READER_URL=https://你的读取服务域名
BOOKMARK_BROWSER_READER_TOKEN=读取服务使用的令牌
```

通过 HTTPS reverse proxy 转发读取服务，请求处理时间至少允许 40 秒。Vercel 调用这个远程地址，浏览器数据持续保存在读取主机中。Vercel 的 `127.0.0.1` 指向函数自己的运行环境。远程桌面和读取服务均需要部署；只配置网址无法创建这些服务。

每个读取服务的数据目录由同一收藏管理员使用。需要多个独立账号环境时，为各自配置独立服务、令牌和数据目录。

## API 与状态判断

读取服务要求 `Authorization: Bearer ...`。网站前端通过已经授权的 `/api/bookmark-preview` 或 `/api/collector` 调用，服务令牌保留在网站服务端。

| 读取服务接口 | 操作 |
| --- | --- |
| `GET /health` | 读取服务运行状态 |
| `POST /preview` | 使用 `{ url }` 读取内容 |
| `POST /login/start` | 使用 `{ url, requestId }` 打开平台页面，`requestId` 为 UUID |
| `POST /login/check` | 使用 `{ sessionId }` 重读原内容，返回 `pending` 或带元数据的 `ready` |
| `POST /login/cancel` | 使用 `{ sessionId }` 取消检查并关闭对应页面，可以重复调用 |

网站 API 使用 `login-start`、`login-check`、`login-cancel` 操作名称。设备授权收藏保留原有来源检查和设备有效期验证。登录操作使用请求标识处理重复提交，服务同一时间只接受一个登录等待任务；已经成功的检查结果保留到任务取消或过期。

`LOGIN_REQUIRED` 来自认证地址、401 响应或阻止内容读取的可见登录表单。`VERIFICATION_REQUIRED` 来自可见的验证组件。`ACCESS_DENIED`、`METADATA_MISSING`、`READ_TIMEOUT` 分别表示访问被拒绝、内容信息缺失和超时。403 与超时各自保留原因。正常短链接的 30x 跳转继续解析。

浏览器读取时限 35 秒，网站 API 等待读取服务 40 秒，前端等待单次预览或登录检查 60 秒。用户取消请求时，对应读取页面会关闭，并释放处理状态。平台能够随时要求重新登录或验证。

## 平台规则与验证

`services/bookmark-reader/platforms.ts` 集中定义平台页面域名、认证域名、资源域名、默认标题与登录组件。`policy.ts` 验证链接和内容标识，`extract.ts` 通过 DOM 读取通用元数据，并处理小红书的笔记状态。抖音还读取页面自己请求的视频详情 JSON，校验响应中的视频 ID 后提取标题与封面。新增平台时补充这些规则，登录会话、API 和表单流程可以复用。

保持读取服务运行并完成需要的平台登录，然后执行：

```bash
npm run test:bookmark-reader
npm run build
```

真实集成测试访问用户提供的小红书和抖音链接，下载实际封面，并检查未登录响应、窗口操作、原链接重试、重复请求、取消请求和并发限制。未登录测试使用 `.debug/` 中的新数据目录，独立于日常登录状态；测试会打开专用 Chrome 窗口。平台内容与网络状态会影响集成测试结果。
