
  # Personal Blog Website

  This is a code bundle for Personal Blog Website. The original project is available at https://www.figma.com/design/tDzlHeV9ELh903zQLa0i1G/Personal-Blog-Website.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

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

  In Supabase **Authentication → URL Configuration**, set **Site URL** to `https://octopus-wiki.vercel.app`. Add `https://octopus-wiki.vercel.app/admin/login**` to **Redirect URLs** and retain `http://localhost:3000/admin/login**` for local Vercel development (use your real Vite port when testing Vite alone). The suffix covers the `next` query parameter. The login page sets `emailRedirectTo` to the current origin's `/admin/login?next=...`; Supabase falls back to Site URL if that address is not allowed. See [Supabase redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

  Keep the Magic Link email's login anchor on `{{ .ConfirmationURL }}` so Supabase verifies the token before redirecting. Do not hard-code localhost or replace the verification link with a plain site URL. Request a new email from the production site after correcting configuration; existing emails retain their old destination. [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).
  For installed Android/iOS apps, copy `supabase/templates/magic-link.html` into Supabase **Authentication → Emails → Magic link or OTP → Body**. It includes `{{ .Token }}` alongside the existing link. The login form verifies the emailed code inside the current app using `verifyOtp({ email, token, type: "email" })`; users can return to code entry after a reload without requesting another email. Git/Vercel deployment does not update Supabase email templates automatically.
  Login emails return to `/admin/login?next=...`; the app validates the session and returns to the requested same-site page. Unknown/external return paths fall back to `/admin/articles`. Login does not auto-create accounts: use an existing administrator user. The hidden entry is not an access-control mechanism; repository, server and RLS authorization checks remain in place.
  This navigation/session update requires no new database migration (comment deletion still requires migration `005`).

  ## Cross-platform bookmark library

  Public bookmarks live at `/collections`; administrators use `/collect` to save links and
  `/admin/bookmarks` to manage resources and collection boxes. Apply
  `database/migrations/007_bookmarks.sql` and `008_bookmark_capture_devices.sql` before using these pages. Both the collection and its
  resource must be public to appear on the public site. Duplicate links are rejected and
  nonempty collections cannot be deleted.

  `/collect/setup` provides a desktop bookmarklet, Android PWA installation/share instructions,
  and an iOS Shortcuts integration recipe. On Android, copy the whole sharing text from the original
  app, open the installed collector, paste into the input, and choose “读取标题与封面”. A link alone
  is enough to request metadata. App-specific share
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
  Images and attachments are streamed through signed `/api/feishu-media` URLs. Running a local
  `feishu2md` process, storing a `configId`, and configuring OBS are no longer required.

  For local end-to-end verification, use `npx vercel dev` so both Vite pages and `/api` Functions
  run on the same origin. Plain `npm run dev` starts only Vite and is suitable for frontend-only
  work; it does not execute Vercel Functions. Put the server-only values in the local Vercel
  environment or `.env.local` before testing a real Feishu document.
