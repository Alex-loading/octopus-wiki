import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";
import { setTimeout } from "node:timers/promises";
import test from "node:test";
import { fetchBookmarkPreview } from "../../api/_lib/bookmark-preview.ts";
import { downloadCover } from "../../api/_lib/cover-download.ts";
import { readerBaseUrl, readerToken } from "../../services/bookmark-reader/config.ts";

const base = readerBaseUrl();
const token = await readerToken();
const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
const source = "https://xhslink.cn/o/isOHHGiso1";
const title = "我在浙大社会学系毕业典礼上的发言🎙️";

async function status(): Promise<{ connected: boolean; reading: boolean }> {
  const response = await fetch(new URL("/health", base), { headers, signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 200);
  return (await response.json()).data;
}

async function waitForReading(reading: boolean): Promise<void> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if ((await status()).reading === reading) return;
    await setTimeout(50);
  }
  assert.fail(`读取服务未进入 reading=${reading} 状态。`);
}

test("真实读取服务要求令牌授权", async () => {
  assert.equal((await status()).connected, true);
  const response = await fetch(new URL("/health", base), { signal: AbortSignal.timeout(5000) });
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "UNAUTHORIZED");
});

test("真实服务拒绝非法链接、登录地址和请求格式", async () => {
  for (const url of [
    "", "invalid", "http://127.0.0.1/", "https://127.0.0.1/",
    "https://www.xiaohongshu.com.evil.example/", "https://user@www.xiaohongshu.com/",
    "https://www.xiaohongshu.com:444/", "https://www.xiaohongshu.com/login",
  ]) {
    const response = await fetch(new URL("/preview", base), {
      method: "POST", headers, body: JSON.stringify({ url }), signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 400, url);
    assert.equal((await response.json()).success, false);
  }
  const malformed = await fetch(new URL("/preview", base), {
    method: "POST", headers, body: "{", signal: AbortSignal.timeout(5000),
  });
  assert.equal(malformed.status, 400);
  const contentType = await fetch(new URL("/preview", base), {
    method: "POST", headers: { Authorization: headers.Authorization, "Content-Type": "text/plain" },
    body: source, signal: AbortSignal.timeout(5000),
  });
  assert.equal(contentType.status, 415);
  const oversized = await fetch(new URL("/preview", base), {
    method: "POST", headers, body: JSON.stringify({ url: "a".repeat(9000) }), signal: AbortSignal.timeout(5000),
  });
  assert.equal(oversized.status, 413);
  assert.equal((await status()).reading, false);
});

test("真实服务拒绝超过限制的 chunked 请求", async () => {
  const client = base.protocol === "https:" ? https : http;
  const result = await new Promise<{ status: number | undefined; code: string }>((resolve, reject) => {
    const request = client.request(new URL("/preview", base), {
      method: "POST", headers, signal: AbortSignal.timeout(5000),
    }, response => {
      const chunks: Buffer[] = [];
      response.on("data", chunk => chunks.push(Buffer.from(chunk)));
      response.on("error", reject);
      response.on("end", () => resolve({
        status: response.statusCode,
        code: JSON.parse(Buffer.concat(chunks).toString("utf8")).code,
      }));
    });
    request.on("error", reject);
    request.write("a".repeat(9000));
    request.end();
  });
  assert.equal(result.status, 413);
  assert.equal(result.code, "INVALID_REQUEST");
});

test("收藏预览读取目标笔记的实际标题及可下载封面", { timeout: 60000 }, async context => {
  const started = Date.now();
  const preview = await fetchBookmarkPreview(source);
  assert.equal(preview.title, title);
  assert.equal(new URL(preview.cover_url).protocol, "https:");
  assert.ok(new URL(preview.cover_url).hostname.endsWith(".xhscdn.com"));
  context.diagnostic(`实际标题：${preview.title}；读取耗时：${Date.now() - started} ms。`);
  const image = await downloadCover(preview.cover_url);
  assert.ok(image.bytes.length > 0);
  assert.ok(image.contentType.startsWith("image/"));
  context.diagnostic(`真实封面：${image.contentType}，${image.bytes.length} bytes。`);
});

test("并发读取明确返回 BUSY，浏览器继续完成已接受的请求", { timeout: 45000 }, async () => {
  const responses = await Promise.all([1, 2].map(() => fetch(new URL("/preview", base), {
    method: "POST", headers, body: JSON.stringify({ url: source }), signal: AbortSignal.timeout(40000),
  })));
  assert.deepEqual(responses.map(response => response.status).sort(), [200, 429]);
  for (const response of responses) {
    const result = await response.json();
    if (response.status === 200) assert.equal(result.data.title, title);
    else assert.equal(result.code, "BUSY");
  }
  assert.equal((await status()).reading, false);
});

test("取消真实读取请求后释放页面并接受后续请求", { timeout: 50000 }, async () => {
  const controller = new AbortController();
  const request = fetch(new URL("/preview", base), {
    method: "POST", headers, body: JSON.stringify({ url: source }), signal: controller.signal,
  });
  const cancelled = assert.rejects(request, { name: "AbortError" });
  await waitForReading(true);
  controller.abort();
  await cancelled;
  await waitForReading(false);
  const preview = await fetchBookmarkPreview(source);
  assert.equal(preview.title, title);
});
