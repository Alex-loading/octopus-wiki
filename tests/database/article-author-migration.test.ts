import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { AUTHOR_AVATARS } from "../../src/app/content/articleAuthor.ts";

test("author migration adds optional signature and constrained built-in avatar without changing RLS", () => {
  const path = new URL("../../database/migrations/006_article_author.sql", import.meta.url);
  assert.ok(existsSync(path), "migration 006 should exist");
  const sql = readFileSync(path, "utf8");
  assert.match(sql, /add column if not exists author_name text/);
  assert.match(sql, /add column if not exists author_avatar text not null default 'everyday'/);
  assert.match(sql, /char_length\(btrim\(author_name\)\) <= 40/);
  for (const avatar of AUTHOR_AVATARS) assert.ok(sql.includes(`'${avatar.id}'`));
  assert.doesNotMatch(sql, /drop table|delete from|create policy|disable row level security/i);
});
