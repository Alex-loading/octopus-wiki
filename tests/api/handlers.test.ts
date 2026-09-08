import assert from "node:assert/strict";
import test from "node:test";

import type { ArticleContentGateway } from "../../api/_lib/content-service.ts";
import { createFeishuContentHandlers } from "../../api/feishu-content.ts";
import { signMediaRequest } from "../../api/_lib/media-signature.ts";
import { createFeishuMediaHandler } from "../../api/feishu-media.ts";

const gateway: ArticleContentGateway = {
  findPublishedArticleBySlug: async (slug) => ({
    id: "article-id",
    slug,
    content: "snapshot",
    feishuDocUrl: "https://tenant.feishu.cn/docx/DocToken123",
    feishuRevisionId: "old",
    feishuSyncedAt: null,
  }),
  updateArticleSnapshot: async () => undefined,
  isAdminAccessToken: async (token) => token === "admin-token",
};

test("content GET validates slug and applies short public CDN caching", async () => {
  const handlers = createFeishuContentHandlers({
    gateway,
    fetchMarkdown: async () => ({ markdown: "live", revisionId: "2", title: "Title", coverImage: null }),
  });

  const invalid = await handlers.GET(new Request("https://example.com/api/feishu-content"));
  assert.equal(invalid.status, 400);

  const response = await handlers.GET(new Request("https://example.com/api/feishu-content?slug=hello"));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "public, s-maxage=60, stale-while-revalidate=300");
  assert.equal(body.success, true);
  assert.equal(body.data.markdown, "live");
});

test("content POST requires an admin bearer token and is never cached", async () => {
  const handlers = createFeishuContentHandlers({
    gateway,
    fetchMarkdown: async () => ({
      markdown: "preview",
      revisionId: "3",
      title: "Title",
      coverImage: "/api/feishu-media?token=image-token&type=image&sig=signed",
    }),
  });
  const requestBody = JSON.stringify({ docUrl: "https://tenant.feishu.cn/docx/DocToken123" });

  const denied = await handlers.POST(new Request("https://example.com/api/feishu-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: requestBody,
  }));
  assert.equal(denied.status, 403);

  const response = await handlers.POST(new Request("https://example.com/api/feishu-content", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer admin-token" },
    body: requestBody,
  }));
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.equal(body.data.markdown, "preview");
  assert.equal(body.data.title, "Title");
  assert.equal(body.data.coverImage, "/api/feishu-media?token=image-token&type=image&sig=signed");
});

test("media GET rejects a tampered signature and streams authorized media", async () => {
  const secret = "media-secret";
  const mediaHandler = createFeishuMediaHandler({
    secret,
    client: {
      downloadMedia: async () => new Response("bytes", {
        headers: { "Content-Type": "image/png", "Content-Length": "5" },
      }),
    },
  });

  const denied = await mediaHandler(new Request(
    "https://example.com/api/feishu-media?token=image-token&type=image&sig=bad",
  ));
  assert.equal(denied.status, 403);

  const sig = signMediaRequest("image-token", "image", secret);
  const response = await mediaHandler(new Request(
    `https://example.com/api/feishu-media?token=image-token&type=image&sig=${sig}`,
  ));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(response.headers.get("Cache-Control"), "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
  assert.equal(await response.text(), "bytes");
});
