
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
  