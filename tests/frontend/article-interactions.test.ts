import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const helperPath = fileURLToPath(new URL("../../src/app/content/articleInteractions.ts", import.meta.url));

async function loadHelpers() {
  assert.equal(existsSync(helperPath), true, "article interaction helpers should exist");
  return import(pathToFileURL(helperPath).href);
}

test("formats article timestamps without exposing seconds or timezone suffixes", async () => {
  const { formatArticleDateTime } = await loadHelpers();
  assert.equal(formatArticleDateTime("2026-08-28T09:53:48.867+00:00"), "2026-08-28 09:53");
  assert.equal(formatArticleDateTime("2026-08-28 09:53:48"), "2026-08-28 09:53");
  assert.equal(formatArticleDateTime("2026-08-28"), "2026-08-28");
  assert.equal(formatArticleDateTime(""), "");
});

test("normalizes anonymous comment input and bounds public values", async () => {
  const {
    commentAvatar,
    normalizeCommentAuthor,
    normalizeCommentContent,
  } = await loadHelpers();

  assert.equal(normalizeCommentAuthor("   "), "匿名");
  assert.equal(normalizeCommentAuthor(`  ${"名".repeat(45)}  `), "名".repeat(40));
  assert.equal(normalizeCommentContent(`  ${"文".repeat(1005)}  `), "文".repeat(1000));
  assert.equal(commentAvatar("匿名"), "匿");
  assert.equal(commentAvatar(" Alice "), "A");
});

test("reuses a valid anonymous visitor id and replaces invalid stored values", async () => {
  const { getOrCreateArticleVisitorId } = await loadHelpers();
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  const firstId = "11111111-1111-4111-8111-111111111111";
  const secondId = "22222222-2222-4222-8222-222222222222";

  assert.equal(getOrCreateArticleVisitorId(storage, () => firstId), firstId);
  assert.equal(getOrCreateArticleVisitorId(storage, () => secondId), firstId);

  values.set("octopus-wiki-article-visitor-id", "not-a-uuid");
  assert.equal(getOrCreateArticleVisitorId(storage, () => secondId), secondId);
});

test("parses Supabase like RPC rows with a safe persisted-count fallback", async () => {
  const { parseArticleLikeState } = await loadHelpers();
  assert.equal(typeof parseArticleLikeState, "function");
  assert.deepEqual(parseArticleLikeState([{ like_count: 7, liked: true }], 3), {
    likeCount: 7,
    liked: true,
  });
  assert.deepEqual(parseArticleLikeState([], 3), { likeCount: 3, liked: false });
  assert.deepEqual(parseArticleLikeState([{ like_count: -2, liked: "yes" }], 3), {
    likeCount: 0,
    liked: false,
  });
});
