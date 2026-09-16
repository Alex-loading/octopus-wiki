
  # Personal Blog Website

  This is a code bundle for Personal Blog Website. The original project is available at https://www.figma.com/design/tDzlHeV9ELh903zQLa0i1G/Personal-Blog-Website.

  ## Running the code

  Use Node.js 24 (`nvm use`), then run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server (normally `http://localhost:5173`).
  It runs Vite and the existing `/api/*` Web Request/Response handlers on the same origin.
  Server credentials load from `.env.local` and stay on the server. No separate Vercel CLI
  process or production API proxy is needed. Direct `/api/*.ts` source requests return 404.

  ## Admin Article Console

  - Login route: `/admin/login`
  - Article management route: `/admin/articles`
  - Click the pixel octopus five times within two seconds to open the login page. The brand text still links home.
  - Verified administrators see a crowned octopus and an **文章管理** link in desktop/mobile navigation. Click the crowned icon and confirm to sign out of the current session.
  - Auth state is shared by navigation, article management and comment deletion. Same-tab reloads retain the session via `sessionStorage`; blocked storage falls back to memory. No admin session is stored in `localStorage`.
  - Admin role source (Supabase JWT app metadata):
    - `role = "admin"`, or
    - `is_admin = true`

  Initialize database migrations before using admin features:

  - `npm run db:init`
  - `npm run db:verify`

  In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://octopus-wiki.vercel.app`. Add `https://octopus-wiki.vercel.app/admin/login**` to **Redirect URLs**, plus `http://localhost:5173/admin/login**` and `http://127.0.0.1:5173/admin/login**` for local development (adjust the port to your actual server). The suffix covers the `next` query parameter. The login page sets `emailRedirectTo` to the current origin's `/admin/login?next=...`; Supabase falls back to Site URL if that address is not allowed. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

  Keep the Magic Link email's login anchor on `{{ .ConfirmationURL }}` so Supabase verifies the token before redirecting. Do not hard-code localhost or replace the verification link with a plain site URL. Request a new email from the production site after correcting configuration; existing emails retain their old destination. [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
  For installed Android/iOS apps, copy `supabase/templates/magic-link.html` into Supabase **Authentication → Emails → Magic link or OTP → Body**. It includes `{{ .Token }}` alongside the existing link. The login form verifies the emailed code inside the current app using `verifyOtp({ email, token, type: "email" })`; users can return to code entry after a reload without requesting another email. Git/Vercel deployment does not update Supabase email templates automatically.
  Login emails return to `/admin/login?next=...`; the app validates the session and returns to the requested same-site page. Unknown/external return paths fall back to `/admin/articles`. Login does not auto-create accounts: use an existing administrator user. The hidden entry is not an access-control mechanism; repository, server and RLS authorization checks remain in place.
  This navigation/session update requires no new database migration (comment deletion still requires migration `005`).

  ## 妙妙屋

  前台入口保持 `/lab`，管理员通过 `/admin/demos` 新增、编辑和删除项目，设置公开状态。部署链接和 GitHub 链接分别填写，均为选填；详情只显示已填写的「部署链接」/「GitHub 仓库」按钮，在新标签页打开。卡片统一使用「了解更多」。

  部署前应用 `database/migrations/009_wonder_room.sql`。前台列表、分类和首页项目数量均读取真实公开记录；无数据展示空状态，读取失败可重试。参见 [妙妙屋使用与验证](docs/plans/2026-09-08-wonder-room.md)。

  ## Cross-platform bookmark library

  Public bookmarks live at `/collections`; administrators use `/collect` to save links and
  `/admin/bookmarks` to manage resources and collection boxes. Apply
  `database/migrations/007_bookmarks.sql`, `008_bookmark_capture_devices.sql`, and
  `011_bookmark_wechat.sql` before using these pages. Both the collection and its
  resource must be public to appear on the public site. Duplicate links are rejected and
  nonempty collections cannot be deleted.

  `/collect/setup` provides a desktop bookmarklet, Android PWA installation/share instructions,
  and an iOS Shortcuts integration recipe. On Android, copy the whole sharing text from the original
  app, open the installed collector, and choose “读取剪贴板并识别信息”. If clipboard permission is
  unavailable, paste into the input first and use the same action. A link alone is enough to request
  metadata. WeChat official account articles on `mp.weixin.qq.com` are supported. App-specific share
  panels cannot be extended through Web Share Target. Sharing text prefills a title, and short links
  remain saveable when metadata is unavailable; covers are optional. The metadata preview
  API reuses the server-only Supabase variables; unsupported or blocked previews can be filled
  manually. Full content backup and synchronization with platform-native favorites are not included.

  Link previews require Node.js 24 (`nvm use`). Xiaohongshu CDN covers published as HTTP are
  upgraded to HTTPS. Douyin video pages without metadata in the initial HTML are rendered with
  an isolated Chromium browser, then read for `lark:url:video_title` and
  `lark:url:video_cover_image_url`. Vercel bundles Chromium and allows up to 60 seconds for the
  two preview-capable APIs. For local development, macOS uses the installed Google Chrome;
  other systems can set `BOOKMARK_CHROME_EXECUTABLE_PATH`. No browser login is required.

  Enable 90-day device authorization once at `/collect/setup` to collect from new windows
  without repeating administrator login. Saved bookmarklets do not update with website deployments;
  replace them from the setup page to pick up new metadata support. The scoped
  `/api/collector` uses server-only Supabase variables and supports revocation; editing and
  deletion continue to require administrator login.

  See [bookmark setup and deployment](docs/plans/2026-09-07-bookmark-library.md) for configuration,
  testing, mobile compatibility and session limitations.

  ## Feishu live article content

  The admin console accepts a Feishu Wiki or Docx URL. Preview and public article reads call
  same-origin Vercel Functions; Feishu credentials and the Supabase service-role key never enter
  the browser bundle. A successful read updates the article Markdown snapshot, while a Feishu
  outage falls back to the last snapshot.

  Configure these server-only variables in Vercel (do not add a `VITE_` prefix):

  - `FEISHU_APP_ID`
  - `FEISHU_APP_SECRET`
  - `FEISHU_MEDIA_SIGNING_SECRET` — a long random value used to sign media proxy URLs
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

  Keep `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for browser-side Supabase access. Never
  expose `FEISHU_APP_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` as client variables.

  Before deployment, run `npm run db:init` so migration
  `database/migrations/003_feishu_live_content.sql` adds the Feishu link and snapshot metadata.

  In the Feishu developer console, grant the application read access for the APIs used by this
  project: Wiki node lookup, Docx document metadata and block listing, Drive media download, and
  Board image download when documents contain whiteboards. The application must also be able to
  access each linked document.

  Public linked articles are refreshed through `/api/feishu-content` with a 60-second CDN cache.
  Images and attachments use signed `/api/feishu-media` URLs. Article images use `<picture>`
  to request a separate `format=webp-lossless-v1` URL in WebP-capable browsers, with the original
  URL as a compatibility and request-failure fallback. Existing article records need no migration.
  The Function attempts lossless WebP only for static 8-bit RGB/RGBA PNGs using ordinary sRGB
  colour information, up to 4 MiB and 6 million pixels. It preserves the resolution and compares
  decoded RGBA pixels, including transparent pixels; only a smaller, identical result is used.
  JPEGs, animations, colour-profiled/high-depth images, unsupported PNGs and conversion failures
  return the original. Larger images and attachments retain the streaming path.

  Both URLs use the existing Vercel CDN (24 hours, with 7 days stale-while-revalidate) plus a
  1-hour browser cache. No object storage, database image blobs or new service configuration is
  required. A CDN miss still downloads from Feishu and may encode; caches can be evicted, so
  conversion is not guaranteed to happen only once. The format is part of the URL, avoiding
  `Accept`-dependent CDN variants; increment its version when changing the encoding policy.
  Replacing a Feishu image normally gives it a new media token/URL; same-token content updates
  remain subject to the cache lifetimes. List covers below the initial rows load lazily.

  Running a local `feishu2md` process, storing a `configId`, and configuring OBS are not required.

  For local end-to-end verification, run `npm run dev`. The local API adapter executes the
  same handlers as production and streams image responses. Put server-only values in `.env.local`
  before testing a real Feishu document. `vite preview` only serves the built frontend; it is
  not a replacement for this development server or a production API runtime.

  ## Persistent bookmark covers

  All bookmark platforms use the same save-time cover archive, including manually supplied
  covers and bookmarklet/mobile captures. Apply `010_bookmark_cover_storage.sql` in Supabase
  before deploying the new `/api/bookmarks` handler. No new credentials are needed.

  Covers are downloaded on the server (8 MiB maximum; JPG, PNG, WebP, GIF and AVIF), validated,
  and uploaded unchanged to the private `bookmark-covers` bucket with a content-hash filename.
  `cover_url` retains the source; `cover_storage_path` is the durable reference. No expiring
  signed download URL is persisted. The browser downloads with Supabase credentials; Storage
  RLS follows the linked bookmark/collection visibility. Anonymous visitors cannot read private
  or unreferenced images. Existing archived covers are reused when editing other fields.

  Downloads validate DNS and pin the socket to a public IP on every redirect. If a local VPN
  returns synthetic `198.18/15` DNS addresses, a fixed Cloudflare HTTPS resolver supplies real
  addresses, which still pass the public-IP check. Internal addresses, SVG/HTML and large
  responses are rejected. Failed archives keep the draft and provide an actionable error.

  Backfill existing records (dry-run by default):

  ```bash
  npm run covers:backfill -- --report /tmp/cover-preview.json
  npm run covers:backfill -- --apply --report /tmp/cover-migration.json
  ```

  The script loads `.env.local`, skips archived/empty covers, tries fresh metadata for expired
  sources, and leaves unavailable images unchanged. Known platform default logos are not
  substituted for resource covers. Conditional updates protect concurrent edits; reruns reuse
  content hashes. The migration report contains record IDs and results, not credentials.
  Removing a bookmark does not automatically delete its image, allowing recovery; unreferenced
  objects remain private. `scripts/db/verify-bookmark-covers.sql` verifies access with a rolled-back
  transaction. Supabase Storage is required; a plain PostgreSQL instance has no object store.
