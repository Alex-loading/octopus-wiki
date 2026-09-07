import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const migrationPath = fileURLToPath(
  new URL("../../database/migrations/004_article_interactions.sql", import.meta.url),
);

test("interaction migration keeps like identities private and constrains public comments", () => {
  assert.equal(existsSync(migrationPath), true, "migration 004 should exist");
  const sql = readFileSync(migrationPath, "utf8").toLowerCase();

  assert.match(sql, /add column if not exists like_count integer/);
  assert.match(sql, /create table if not exists public\.article_likes/);
  assert.match(sql, /unique\s*\(article_id, visitor_id\)/);
  assert.match(sql, /create table if not exists public\.article_comments/);
  assert.match(sql, /enable row level security/);
  assert.match(sql, /create policy "public can read comments on published articles"/);
  assert.match(sql, /create policy "public can comment on published articles"/);
  assert.match(sql, /char_length\(btrim\(author_name\)\) between 1 and 40/);
  assert.match(sql, /char_length\(btrim\(content\)\) between 1 and 1000/);
  assert.match(sql, /create or replace function public\.get_article_like_state/);
  assert.match(sql, /create or replace function public\.set_article_like/);
  assert.match(sql, /security definer/);
  assert.match(sql, /revoke all on table public\.article_likes from anon, authenticated/);
  assert.match(sql, /grant select, insert on table public\.article_comments to anon, authenticated/);
});

test("comment deletion migration grants authenticated DELETE with an admin-only RLS restriction", () => {
  const path = new URL("../../database/migrations/005_admin_comment_deletion.sql", import.meta.url);
  assert.equal(existsSync(path), true, "migration 005 should exist");
  const sql = readFileSync(path, "utf8").toLowerCase();
  assert.match(sql, /revoke delete on table public\.article_comments from public, anon/);
  assert.match(sql, /grant delete on table public\.article_comments to authenticated/);
  assert.match(sql, /as restrictive\s+for delete\s+to authenticated/);
  assert.match(sql, /auth\.jwt\(\)[\s\S]*app_metadata[\s\S]*role[\s\S]*admin/);
  assert.match(sql, /app_metadata[\s\S]*is_admin/);
  assert.doesNotMatch(sql, /user_metadata|visitor_id|delete from|drop table/);
});
