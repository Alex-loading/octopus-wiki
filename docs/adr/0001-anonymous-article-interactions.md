# ADR-0001: Use Supabase-backed anonymous article interactions

## Status

Accepted

## Context

Article dates currently expose raw PostgreSQL timestamps. Likes and comments are generated in browser memory, so their values are different after every refresh and are not shared between readers. Comments must support guests who either leave the name empty or provide a display name, while bookmarks are intentionally out of scope.

The existing application already reads public article data from Supabase through the anonymous client. The interaction design should stay lightweight, preserve atomic like counts, avoid exposing anonymous browser identifiers, and constrain public comment writes.

## Decision

- Store an aggregate `like_count` on `articles` for inexpensive list/card reads.
- Store one `article_likes` row per article and browser-generated UUID. Do not grant clients direct table access.
- Expose security-definer PostgreSQL functions for reading the current browser's like state and atomically setting liked/unliked state.
- Store comments in `article_comments`. Allow public reads and inserts only when the parent article is published and not deleted. Constrain names to 40 characters and comment bodies to 1000 characters.
- Treat an empty display name as `匿名` in the application before insertion.
- Format ISO timestamps by their supplied calendar fields as `YYYY-MM-DD HH:mm`, without browser-timezone conversion.
- Remove bookmark state and UI. Article cards display persisted like counts; the detail page owns the like interaction.

## Consequences

### Positive

- Counts and comments are shared, persistent data instead of browser mock values.
- Like updates are idempotent per browser and safe under concurrent requests.
- Anonymous identifiers remain private behind RPC functions.
- The design adds no new server runtime or client secret.

### Negative

- Clearing browser storage creates a new anonymous identity, so it is not a strong anti-abuse mechanism.
- Public comments need future moderation and rate limiting if traffic or abuse increases.
- The database migration must be applied before the UI can write interactions.

### Neutral

- Article reads gain one integer column; detail pages make additional interaction and comment requests.

## Alternatives Considered

- **Vercel Serverless interaction API:** offers centralized rate limiting but adds runtime and operational weight for simple Supabase data.
- **Direct public access to like rows:** simpler, but exposes pseudonymous visitor identifiers and makes safe unlike authorization difficult.
- **Require authenticated users:** stronger identity, but conflicts with the anonymous-comment requirement.

## References

- `database/migrations/004_article_interactions.sql`
- `src/app/content/repository.ts`
- `src/app/pages/Post.tsx`
