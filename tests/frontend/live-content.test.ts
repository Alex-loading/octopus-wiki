import assert from "node:assert/strict";
import test from "node:test";

import type { Post } from "../../src/app/data/posts.ts";
import {
  fetchLiveArticleContent,
  previewFeishuDocument,
} from "../../src/app/content/liveContent.ts";

const post: Post = {
  id: "1",
  slug: "hello",
  title: "Hello",
  excerpt: "",
  content: "snapshot",
  coverImage: "",
  tags: [],
  category: "Test",
  date: "2026-08-28",
  readTime: 1,
  feishuDocUrl: "https://tenant.feishu.cn/docx/DocToken123",
};

test("merges successful public live content into the database snapshot", async () => {
  const result = await fetchLiveArticleContent(post, async (input) => {
    assert.equal(String(input), "/api/feishu-content?slug=hello");
    return Response.json({
      success: true,
      data: {
        markdown: "live markdown",
        revisionId: "9",
        syncedAt: "2026-08-28T01:00:00.000Z",
        stale: false,
        source: "live",
      },
    });
  });

  assert.equal(result.content, "live markdown");
  assert.equal(result.feishuRevisionId, "9");
  assert.equal(result.feishuSyncedAt, "2026-08-28T01:00:00.000Z");
});

test("does not fetch for an ordinary article", async () => {
  let called = false;
  const result = await fetchLiveArticleContent({ ...post, feishuDocUrl: undefined }, async () => {
    called = true;
    throw new Error("unexpected");
  });
  assert.equal(called, false);
  assert.equal(result.content, "snapshot");
});

test("sends an authenticated same-origin preview request", async () => {
  const result = await previewFeishuDocument(post.feishuDocUrl ?? "", "admin-access-token", async (_input, init) => {
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer admin-access-token");
    assert.deepEqual(JSON.parse(String(init?.body)), { docUrl: post.feishuDocUrl });
    return Response.json({
      success: true,
      data: {
        markdown: "preview",
        revisionId: "10",
        title: "Title",
        coverImage: "/api/feishu-media?token=image-token&type=image&sig=signed",
      },
    });
  });
  assert.equal(result.markdown, "preview");
  assert.equal(result.title, "Title");
  assert.equal(result.coverImage, "/api/feishu-media?token=image-token&type=image&sig=signed");
});

test("surfaces API error messages to the admin", async () => {
  await assert.rejects(
    () => previewFeishuDocument(post.feishuDocUrl ?? "", "token", async () => Response.json(
      { success: false, code: "INVALID_FEISHU_URL", message: "链接无效" },
      { status: 400 },
    )),
    /INVALID_FEISHU_URL: 链接无效/,
  );
});
