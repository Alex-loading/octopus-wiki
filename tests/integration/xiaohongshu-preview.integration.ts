import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { allowedPreviewUrl, fetchBookmarkPreview } from "../../api/_lib/bookmark-preview.ts";
import { downloadCover } from "../../api/_lib/cover-download.ts";

const noteId = "6a33dbfc0000000015024b49";
const noteUrl = `https://www.xiaohongshu.com/explore/${noteId}?xsec_token=CBBAZJ6SYyPCiEWwKE41WcIpcHEXgENtlNSZCQI-gZJ9U=&xsec_source=app_share`;
const expectedTitle = "我在浙大社会学系毕业典礼上的发言🎙️ - 小红书";

test("真实小红书短链和笔记地址返回帖子标题与可下载封面", { timeout: 60000 }, async t => {
  for (const url of ["https://xhslink.cn/o/isOHHGiso1", noteUrl, noteUrl.replace("/explore/", "/discovery/item/")]) {
    await t.test(url, async () => {
      const preview = await fetchBookmarkPreview(url);
      assert.equal(preview.title, expectedTitle);
      assert.equal(new URL(preview.cover_url).protocol, "https:");
      assert.ok(new URL(preview.cover_url).hostname.endsWith(".xhscdn.com"));
      const image = await downloadCover(preview.cover_url);
      const metadata = await sharp(image.bytes).metadata();
      assert.ok(image.bytes.length > 0);
      assert.equal(metadata.width, 1080);
      assert.equal(metadata.height, 1440);
    });
  }
});

test("小红书登录页和列表页在发送请求之前被拒绝", () => {
  for (const url of [
    "https://www.xiaohongshu.com/login",
    `https://www.xiaohongshu.com/login?redirectPath=${encodeURIComponent(noteUrl)}`,
    "https://www.xiaohongshu.com/website-login/error",
    "https://www.xiaohongshu.com/explore",
  ]) assert.throws(() => allowedPreviewUrl(url), /登录页|笔记链接/);
});

test("真实 HTTP 登录重定向在请求登录页之前终止", { timeout: 10000 }, async () => {
  const visited: URL[] = [];
  const observedFetch: typeof fetch = async (input, options) => {
    visited.push(new URL(String(input)));
    return fetch(input, options);
  };
  await assert.rejects(fetchBookmarkPreview(noteUrl, observedFetch), /登录页/);
  assert.equal(visited.length, 1);
  assert.equal(visited[0].pathname, `/explore/${noteId}`);
});
