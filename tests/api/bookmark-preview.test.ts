import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedPreviewUrl,
  fetchBookmarkPreview,
  parsePreviewHtml,
} from "../../api/_lib/bookmark-preview.ts";
import { createBookmarkPreviewHandler } from "../../api/bookmark-preview.ts";

test("metadata parses reversed attributes, entities and relative images", () => {
  const result = parsePreviewHtml(
    `<title>fallback</title><meta content='标题 &amp; &#x4e2d;&#25991;' property="og:title"><meta property="og:image" content="/image.jpg?a=1&amp;b=2">`,
    "https://www.bilibili.com/video/123",
  );
  assert.deepEqual(result, {
    title: "标题 & 中文",
    cover_url: "https://www.bilibili.com/image.jpg?a=1&b=2",
  });
  assert.equal(
    parsePreviewHtml(
      '<meta property="og:image" content="javascript:alert(1)">',
      "https://www.bilibili.com",
    ).cover_url,
    "",
  );
});
test("preview allows only known HTTPS hosts and validates every redirect before fetching it", async () => {
  for (const url of [
    "http://www.bilibili.com",
    "https://www.bilibili.com.evil.example",
    "https://127.0.0.1",
    "https://user@www.bilibili.com",
    "https://www.bilibili.com:444",
    "https://arbitrary.bilibili.com",
  ])
    assert.throws(() => allowedPreviewUrl(url));
  let calls = 0;
  await assert.rejects(
    fetchBookmarkPreview("https://b23.tv/abc", (async () => {
      calls++;
      return new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/private" },
      });
    }) as typeof fetch),
    /不支持自动读取/,
  );
  assert.equal(calls, 1);
});
test("follows approved short links and bounds content and redirect loops", async () => {
  const requests: string[] = [];
  const result = await fetchBookmarkPreview("https://b23.tv/abc", (async (
    url,
    options,
  ) => {
    requests.push(String(url));
    assert.equal(options?.redirect, "manual");
    assert.ok(options?.signal);
    return requests.length === 1
      ? new Response(null, {
          status: 302,
          headers: { location: "https://www.bilibili.com/video/BVabc" },
        })
      : new Response("<title>一个视频</title>", {
          headers: { "content-type": "text/html" },
        });
  }) as typeof fetch);
  assert.equal(result.title, "一个视频");
  assert.equal(requests.length, 2);
  await assert.rejects(
    fetchBookmarkPreview(
      "https://www.bilibili.com",
      (async () =>
        new Response("x".repeat(512 * 1024 + 1), {
          headers: { "content-type": "text/html" },
        })) as typeof fetch,
    ),
    /过大/,
  );
  await assert.rejects(
    fetchBookmarkPreview(
      "https://b23.tv/abc",
      (async () =>
        new Response(null, {
          status: 302,
          headers: { location: "/abc" },
        })) as typeof fetch,
    ),
    /跳转过多/,
  );
});
test("preview authenticates before any fetch, keeps replies private and gracefully fails", async () => {
  let calls = 0;
  const handler = createBookmarkPreviewHandler({
    isAdmin: async (token) => token === "admin",
    preview: async () => {
      calls++;
      throw new Error("请手动填写");
    },
  });
  const request = (token = "") =>
    new Request("https://wiki.example/api/bookmark-preview", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: "https://b23.tv/abc" }),
    });
  assert.equal((await handler(request())).status, 403);
  assert.equal((await handler(request("reader"))).status, 403);
  assert.equal(calls, 0);
  const result = await handler(request("admin"));
  assert.equal(result.status, 422);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.equal((await result.json()).message, "请手动填写");
  assert.equal(calls, 1);
});
