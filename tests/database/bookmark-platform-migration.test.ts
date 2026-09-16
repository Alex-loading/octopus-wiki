import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("bookmark platform migration adds WeChat without weakening the platform constraint", () => {
  const path = new URL("../../database/migrations/011_bookmark_wechat.sql", import.meta.url);
  assert.ok(existsSync(path), "migration 011 should exist");
  const sql = readFileSync(path, "utf8").toLowerCase();
  assert.match(sql, /drop constraint if exists bookmarks_platform_check/);
  assert.match(sql, /platform in \('bilibili', 'douyin', 'xiaohongshu', 'nowcoder', 'wechat', 'other'\)/);
  assert.doesNotMatch(sql, /drop table|delete from|disable row level security/);
});
