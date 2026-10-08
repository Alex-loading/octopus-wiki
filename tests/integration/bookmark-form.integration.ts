import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import puppeteer from "puppeteer-core";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import { BookmarkBrowserReader } from "../../services/bookmark-reader/browser.ts";
import { createReaderServer } from "../../services/bookmark-reader/server.ts";

test("真实表单保留手动输入，并在更换链接和关闭表单时取消登录检查", { timeout: 120000 }, async context => {
  await mkdir(resolve(".debug"), { recursive: true });
  const directory = await mkdtemp(resolve(".debug/bookmark-form-"));
  const reader = new BookmarkBrowserReader(directory);
  const token = randomBytes(32).toString("base64url");
  const server = createReaderServer(reader, token);
  await reader.start(false);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const vite = await createServer({
    configFile: false, root: resolve("."), cacheDir: resolve(directory, "vite-cache"),
    plugins: [react()], server: { host: "127.0.0.1", port: 0, proxy: {
      "/reader": { target: `http://127.0.0.1:${address.port}`, rewrite: path => path.slice("/reader".length),
        headers: { Authorization: `Bearer ${token}` } },
    } },
  });
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    await vite.listen();
    const origin = vite.resolvedUrls!.local[0];
    browser = await puppeteer.launch({
      executablePath: process.env.BOOKMARK_CHROME_EXECUTABLE_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true, userDataDir: resolve(directory, "ui-profile"),
      env: { PATH: process.env.PATH ?? "", TMPDIR: resolve(directory, "runtime") },
    });
    await browser.defaultBrowserContext().overridePermissions(origin, []);
    const page = await browser.newPage();
    page.setDefaultTimeout(45000);
    await page.goto(`${origin}tests/integration/browser/bookmark-form.html`);
    const field = (label: string) => `[aria-label="${label}"]`;
    const replace = async (label: string, value: string) => {
      await page.locator(field(label)).fill(value);
      assert.equal(await page.$eval(field(label), element => (element as HTMLInputElement).value), value);
    };
    const click = async (text: string) => {
      const buttons = await page.$$("button");
      for (const button of buttons) {
        if ((await button.evaluate(element => element.textContent))?.trim() === text) {
          await button.click();
          return;
        }
      }
      assert.fail(`页面中没有按钮：${text}`);
    };
    const waitForReaderIdle = async () => {
      const deadline = Date.now() + 5000;
      while (reader.status().loginPending || reader.status().reading) {
        assert.ok(Date.now() < deadline, "取消后读取服务未释放任务。");
        await setTimeout(50);
      }
    };

    await replace("标题", "手动编辑的标题");
    await replace("备注", "保留的收藏备注");
    await click("读取剪贴板并识别信息");
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="封面链接"]')!.value.startsWith("https://"));
    assert.equal(await page.$eval(field("标题"), element => (element as HTMLInputElement).value), "手动编辑的标题");
    assert.equal(await page.$eval(field("备注"), element => (element as HTMLInputElement).value), "保留的收藏备注");

    const startInteraction = async () => {
      await replace("链接或分享文案", "https://www.xiaohongshu.com/notification");
      await click("读取剪贴板并识别信息");
      await page.waitForFunction(() => Array.from(document.querySelectorAll("button"))
        .some(button => button.textContent?.includes("打开平台页面并继续读取")));
      await click("打开平台页面并继续读取");
      await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes("最多等待 10 分钟"));
      assert.equal(reader.status().loginPending, true);
    };
    await startInteraction();
    await replace("链接或分享文案", "https://xhslink.cn/o/isOHHGiso1");
    await waitForReaderIdle();
    assert.equal(await page.$eval(field("标题"), element => (element as HTMLInputElement).value), "手动编辑的标题");
    await startInteraction();
    await click("取消");
    await waitForReaderIdle();
    assert.equal(await page.$("form"), null);
  } catch (error) {
    const page = (await browser?.pages())?.find(item => item.url().includes("bookmark-form.html"));
    if (page) context.diagnostic(JSON.stringify(await page.evaluate(() => ({
      source: document.querySelector<HTMLTextAreaElement>('[aria-label="链接或分享文案"]')?.value,
      message: document.querySelector('[role="status"]')?.textContent,
      buttons: Array.from(document.querySelectorAll("button")).map(button => button.textContent),
    }))));
    throw error;
  } finally {
    await browser?.close();
    await vite.close();
    await reader.close();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
