import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { fetchBookmarkPreview } from "../../api/_lib/bookmark-preview.ts";
import { downloadCover } from "../../api/_lib/cover-download.ts";

const urls = [
  "https://v.douyin.com/6MpTQKvLb3M/",
  "https://www.douyin.com/video/7698986937880743211",
];

test("真实抖音短链接和视频地址返回作品标题与可解码封面", { timeout: 240000 }, async t => {
  let expectedTitle: string | undefined;
  for (const url of urls) {
    await t.test(url, { timeout: 120000 }, async () => {
      const started = performance.now();
      const preview = await fetchBookmarkPreview(url);
      const previewDurationMs = Math.round(performance.now() - started);
      assert.match(preview.title, /Vibe知识大赏/);
      assert.match(preview.title, /vLLM/);
      if (expectedTitle === undefined) expectedTitle = preview.title;
      else assert.equal(preview.title, expectedTitle);

      const coverUrl = new URL(preview.cover_url);
      assert.equal(coverUrl.protocol, "https:");
      assert.ok(coverUrl.hostname.endsWith(".douyinpic.com"));
      const image = await downloadCover(preview.cover_url);
      assert.ok(image.bytes.length > 0);
      const decoded = await sharp(image.bytes).raw().toBuffer({ resolveWithObject: true });
      assert.ok(decoded.info.width > 0);
      assert.ok(decoded.info.height > 0);
      assert.equal(decoded.data.length, decoded.info.width * decoded.info.height * decoded.info.channels);

      t.diagnostic(JSON.stringify({
        url,
        title: preview.title,
        previewDurationMs,
        totalDurationMs: Math.round(performance.now() - started),
        coverHost: coverUrl.hostname,
        contentType: image.contentType,
        width: decoded.info.width,
        height: decoded.info.height,
        bytes: image.bytes.length,
      }));
    });
  }
});
