
  # Personal Blog Website

  This is a code bundle for Personal Blog Website. The original project is available at https://www.figma.com/design/tDzlHeV9ELh903zQLa0i1G/Personal-Blog-Website.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Admin Article Console

  - Login route: `/admin/login`
  - Article management route: `/admin/articles`
  - Admin role source (Supabase JWT app metadata):
    - `role = "admin"`, or
    - `is_admin = true`

  Initialize database migrations before using admin features:

  - `npm run db:init`
  - `npm run db:verify`

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
