import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import puppeteer from "puppeteer-core";
import { BookmarkBrowserReader } from "../../services/bookmark-reader/browser.ts";
import { createReaderServer } from "../../services/bookmark-reader/server.ts";
import { bookmarkReaderCommand, readBookmarkPreview } from "../../api/_lib/bookmark-browser-client.ts";
import { BookmarkPreviewError, needsBookmarkInteraction, previewResponseError } from "../../src/app/content/bookmarkPreview.ts";

const source = "https://xhslink.cn/o/isOHHGiso1";
const douyin = "https://v.douyin.com/L2bDoFtzeH8/";
const protectedPage = "https://www.xiaohongshu.com/notification";

test("真实 Chrome 区分可读内容与平台拦截，并管理交互会话", { timeout: 120000 }, async context => {
  await mkdir(resolve(".debug"), { recursive: true });
  const directory = await mkdtemp(resolve(".debug/bookmark-login-"));
  const reader = new BookmarkBrowserReader(directory);
  const token = randomBytes(32).toString("base64url");
  const server = createReaderServer(reader, token);
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
  await reader.start(false);
  try {
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const request = (path: string, input: unknown) => fetch(`${base}${path}`, {
      method: "POST", headers, body: JSON.stringify(input), signal: AbortSignal.timeout(40000),
    });
    const publicContent = await request("/preview", { url: source });
    assert.equal(publicContent.status, 200);
    assert.equal((await publicContent.json()).data.title, "我在浙大社会学系毕业典礼上的发言🎙️");
    const response = await request("/preview", { url: protectedPage });
    assert.equal(response.status, 422);
    const failure = await response.json();
    assert.ok(["LOGIN_REQUIRED", "ACCESS_DENIED", "VERIFICATION_REQUIRED"].includes(failure.code), failure.code);
    assert.equal(failure.platform, "xiaohongshu");
    assert.equal(needsBookmarkInteraction(previewResponseError(failure, response.status)), true);
    context.diagnostic(`受保护页面的真实响应：${failure.code}。`);

    const id = randomUUID();
    const opened = await request("/login/start", { url: protectedPage, requestId: id });
    assert.equal(opened.status, 200);
    assert.equal((await opened.json()).data.id, id);
    assert.equal(reader.status().headed, true);
    assert.equal(reader.status().loginPending, true);
    const duplicate = await request("/login/start", { url: protectedPage, requestId: id });
    assert.equal((await duplicate.json()).data.id, id);
    assert.equal((await request("/login/start", { url: douyin, requestId: randomUUID() })).status, 429);
    const pending = await request("/login/check", { sessionId: id });
    assert.deepEqual((await pending.json()).data, { status: "pending" });

    const port = (await readFile(resolve(directory, "profile/DevToolsActivePort"), "utf8")).split("\n")[0];
    const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${port}` });
    try {
      const loginPage = (await browser.pages()).find(page => page.url().includes("xiaohongshu.com"));
      assert.ok(loginPage);
      await loginPage.close();
    } finally { await browser.disconnect(); }
    const closed = await request("/login/check", { sessionId: id });
    assert.equal((await closed.json()).code, "LOGIN_WINDOW_CLOSED");
    assert.equal((await request("/login/cancel", { sessionId: id })).status, 200);
    assert.equal(reader.status().loginPending, false);
    assert.equal((await request("/login/check", { sessionId: id })).status, 410);
    assert.equal((await request("/login/cancel", { sessionId: id })).status, 200);
  } finally {
    await reader.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("抖音与小红书共用实际读取和登录后重试入口", { timeout: 120000 }, async context => {
  const preview = await readBookmarkPreview(douyin);
  assert.match(preview.title, /爱是允许失控/u);
  assert.equal(new URL(preview.cover_url).protocol, "https:");
  context.diagnostic(`抖音实际标题：${preview.title}。`);
  const id = randomUUID();
  try {
    const session = await bookmarkReaderCommand({ action: "login-start", url: source, requestId: id });
    assert.ok(session && "id" in session && session.id === id);
    const checked = await bookmarkReaderCommand({ action: "login-check", sessionId: id });
    assert.ok(checked && "status" in checked && checked.status === "ready");
    assert.equal(checked.metadata.title, "我在浙大社会学系毕业典礼上的发言🎙️");
    const duplicate = await bookmarkReaderCommand({ action: "login-check", sessionId: id });
    assert.deepEqual(duplicate, checked);
  } finally {
    await bookmarkReaderCommand({ action: "login-cancel", sessionId: id });
  }
  await assert.rejects(bookmarkReaderCommand({ action: "login-check", sessionId: id }), error =>
    error instanceof BookmarkPreviewError && error.code === "LOGIN_EXPIRED");
});
