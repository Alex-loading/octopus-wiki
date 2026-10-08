import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createServer } from "vite";
import puppeteer, { type Browser } from "puppeteer-core";
import { convertFeishuDocumentToMarkdown } from "../../api/_lib/markdown.ts";
import type { FeishuDocument } from "../../api/_lib/feishu.ts";

test("真实飞书图片在宽屏和窄屏按列宽与内容顺序展示", { timeout: 120000 }, async () => {
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
      }
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await server.close();
  }
});
