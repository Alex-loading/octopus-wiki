import { tmpdir } from "node:os";
import { parsePreviewHtml } from "./bookmark-preview.ts";
import { allowedDouyinResource, douyinVideoPage } from "./douyin-render-policy.ts";
import type { Browser } from "puppeteer-core";

let rendering = false;

export async function renderDouyinPreview(value: string): Promise<{ title: string; cover_url: string }> {
  const url = douyinVideoPage(value);
  if (!url) throw new Error("只支持读取抖音视频页面。");
  if (rendering) throw new Error("正在读取另一条抖音链接，请稍后重试。");
  rendering = true;
  let browser: Browser | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const { default: puppeteer } = await import("puppeteer-core");
    // Local development uses an isolated profile, never the user's Chrome data.
    const localPath = process.env.BOOKMARK_CHROME_EXECUTABLE_PATH ||
      (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "");
    const chromium = localPath ? null : (await import("@sparticuz/chromium")).default;
    const executablePath = localPath || await chromium!.executablePath();
    browser = await puppeteer.launch({
      executablePath,
      headless: localPath ? true : "shell",
      args: chromium?.args ?? [],
      timeout: 12000,
      protocolTimeout: 25000,
      defaultViewport: { width: 1280, height: 720 },
      // The browser has no access to the server's Supabase/Feishu credentials.
      env: {
        PATH: process.env.PATH ?? "",
        HOME: tmpdir(), TMPDIR: tmpdir(),
        ...(process.env.LD_LIBRARY_PATH ? { LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH } : {}),
        ...(process.env.FONTCONFIG_PATH ? { FONTCONFIG_PATH: process.env.FONTCONFIG_PATH } : {}),
      },
    });
    timeout = setTimeout(() => browser?.process()?.kill("SIGKILL"), 30000);
    const page = await browser.newPage();
    page.setDefaultTimeout(22000);
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on("request", request => {
      const navigationAllowed = !request.isNavigationRequest() ||
        (request.frame() === page.mainFrame() && douyinVideoPage(request.url()) === url);
      const action = navigationAllowed && allowedDouyinResource(request.url(), request.resourceType())
        ? request.continue() : request.abort();
      void action.catch(() => {});
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForFunction(`Boolean(document.querySelector('meta[name="lark:url:video_title"]')?.content && document.querySelector('meta[name="lark:url:video_cover_image_url"]')?.content)`);
    const meta = await page.evaluate(`Array.from(document.head.querySelectorAll('meta[name="lark:url:video_title"],meta[name="lark:url:video_cover_image_url"]')).map(node => node.outerHTML).join('')`) as string;
    if (meta.length > 16000) throw new Error("Video metadata exceeded limit");
    const preview = parsePreviewHtml(meta, url);
    if (!preview.title || !preview.cover_url) throw new Error("Video metadata is incomplete");
    return preview;
  } catch (error) {
    console.warn("Douyin preview rendering failed:", error instanceof Error ? error.message.slice(0, 300) : "unknown");
    throw new Error("抖音页面暂未返回视频信息，请稍后重试；已有输入会保留。");
  } finally {
    if (timeout) clearTimeout(timeout);
    if (browser) {
      const forceClose = setTimeout(() => browser?.process()?.kill("SIGKILL"), 2000);
      await browser.close().catch(() => {});
      clearTimeout(forceClose);
    }
    rendering = false;
  }
}
