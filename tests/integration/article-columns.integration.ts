import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import { convertFeishuDocumentToMarkdown } from "../../api/_lib/markdown.ts";
import type { FeishuDocument } from "../../api/_lib/feishu.ts";

async function verifyImageViewer(page: Page) {
  const triggers = await page.$$("[data-article-image-trigger]");
  const images = await page.$$("img[data-article-image]");
  assert.equal(triggers.length, images.length, "每张正文图片都可以打开浏览窗口。");
  assert.ok(triggers.length >= 3);

  for (const [index, trigger] of triggers.entries()) {
    await trigger.scrollIntoView();
    await trigger.$eval("img", async (image) => {
      await (image as HTMLImageElement).decode();
    });
    await trigger.scrollIntoView();
    await trigger.focus();
    const source = await trigger.$eval("img", (image) => image.getAttribute("src"));
    const scrollY = await page.evaluate(() => window.scrollY);
    if (index % 3 === 0) await trigger.click();
    if (index % 3 === 1) await page.keyboard.press("Enter");
    if (index % 3 === 2) await page.keyboard.press("Space");
    await page.waitForSelector('[role="dialog"]', { visible: true });

    const preview = await page.$eval('[role="dialog"] img', async (element) => {
      const image = element as HTMLImageElement;
      await image.decode();
      const bounds = image.getBoundingClientRect();
      const dialog = image.closest('[role="dialog"]')!;
      const title = document.getElementById(dialog.getAttribute("aria-labelledby")!);
      return {
        src: image.getAttribute("src"),
        width: image.naturalWidth,
        height: image.naturalHeight,
        contained: bounds.left >= 0 && bounds.top >= 0 && bounds.right <= innerWidth && bounds.bottom <= innerHeight,
        scrollLocked: getComputedStyle(document.body).overflow === "hidden",
        focused: dialog.contains(document.activeElement),
        title: title?.textContent,
      };
    });
    assert.equal(preview.src, source, "浏览窗口应显示当前点击的图片。");
    assert.ok(preview.width > 0 && preview.height > 0);
    assert.ok(preview.contained, "图片应完整显示在当前屏幕内。");
    assert.ok(preview.scrollLocked);
    assert.ok(preview.focused);
    assert.ok(preview.title);
    await page.keyboard.press("Tab");
    assert.ok(await page.$eval('[role="dialog"]', (dialog) => dialog.contains(document.activeElement)));
    await page.keyboard.press("Tab");
    assert.ok(await page.$eval('[role="dialog"]', (dialog) => dialog.contains(document.activeElement)));

    await page.click('[role="dialog"] img');
    assert.ok(await page.$('[role="dialog"]'), "点击图片应保持浏览窗口打开。");
    if (index % 3 === 0) await page.keyboard.press("Escape");
    if (index % 3 === 1) await page.click('button[aria-label="关闭图片浏览"]');
    if (index % 3 === 2) await page.mouse.click(8, 8);
    await page.waitForSelector('[role="dialog"]', { hidden: true });
    await page.waitForFunction(() => getComputedStyle(document.body).overflow !== "hidden");
    await page.waitForFunction((element) => document.activeElement === element, {}, trigger);
    const restoredScrollY = await page.evaluate(() => window.scrollY);
    assert.ok(Math.abs(restoredScrollY - scrollY) < 2, `图片 ${index + 1} 关闭后保留文章阅读位置：${scrollY} → ${restoredScrollY}。`);
  }
}

test("真实飞书分栏图片适应宽窄屏并支持图片浏览与键盘操作", { timeout: 120000 }, async () => {
  const runtime = resolve(".debug/article-columns/runtime");
  await mkdir(runtime, { recursive: true });
  const source: FeishuDocument = JSON.parse(await readFile("tests/fixtures/feishu-mcp-columns.json", "utf8"));
  const secret = process.env.FEISHU_MEDIA_SIGNING_SECRET;
  assert.ok(secret, "浏览器集成验证需要飞书媒体签名配置。");
  const { markdown } = convertFeishuDocumentToMarkdown(source, secret);
  await writeFile(resolve(runtime, "../content.json"), JSON.stringify([{ slug: "all-about-mcp", markdown }]));
  const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "error" });
  await server.listen();
  const address = server.httpServer!.address();
  assert.ok(address && typeof address === "object");
  let browser: Browser | undefined;

  try {
    browser = await puppeteer.launch({
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      userDataDir: resolve(runtime, "chrome-profile"),
      env: { ...process.env, TMPDIR: runtime },
      headless: true,
      pipe: true,
    });
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String(error)));

    for (const theme of ["light", "dark"]) {
      await page.setViewport({ width: 1280, height: 900 });
      await page.goto(`http://127.0.0.1:${address.port}/tests/integration/browser/article-columns.html?theme=${theme}`, { waitUntil: "networkidle0" });
      await page.waitForSelector("[data-feishu-grid] img");
      const images = await page.$$eval("[data-feishu-grid] img", async (elements) => {
        return Promise.all(elements.map(async (element) => {
          const image = element as HTMLImageElement;
          image.loading = "eager";
          await image.decode();
          return { width: image.naturalWidth, height: image.naturalHeight, src: image.currentSrc };
        }));
      });
      assert.equal(images.length, 3);
      assert.ok(images.every((image) => image.width > 0 && image.height > 0 && image.src.includes("format=webp-lossless-v1")));

      for (const width of [1280, 390]) {
        await page.setViewport({ width, height: 900 });
        const grids = await page.$$eval("[data-feishu-grid]", (elements) => elements.map((grid) => ({
          width: grid.clientWidth,
          scrollWidth: grid.scrollWidth,
          columns: [...grid.children].map((column) => {
            const bounds = column.getBoundingClientRect();
            return { x: bounds.x, y: bounds.y, width: bounds.width, bottom: bounds.bottom };
          }),
        })));
        assert.equal(grids.length, 2);
        for (const [index, grid] of grids.entries()) {
          const [first, second] = grid.columns;
          assert.ok(grid.scrollWidth <= grid.width + 1);
          if (width === 1280) {
            assert.ok(Math.abs(first.y - second.y) < 1);
            assert.ok(second.x >= first.x + first.width + 15);
            assert.ok(Math.abs(first.width / second.width - (index === 0 ? 62 / 37 : 1)) < 0.01);
          } else {
            assert.ok(Math.abs(first.x - second.x) < 1);
            assert.ok(second.y >= first.bottom + 15);
            assert.ok(Math.abs(first.width - second.width) < 1);
          }
        }
        await verifyImageViewer(page);
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
