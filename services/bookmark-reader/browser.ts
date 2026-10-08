import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer, { type Browser, type Page } from "puppeteer-core";
import {
  needsBookmarkInteraction, type BookmarkMetadata, type BookmarkLoginSession,
  type BookmarkLoginResult,
} from "../../src/app/content/bookmarkPreview.ts";
import { readerInteraction } from "./config.ts";
import { inspectPlatformPage } from "./extract.ts";
import { observeDouyinMetadata } from "./network.ts";
import { READER_PLATFORMS, type ReaderPlatform } from "./platforms.ts";
import {
  allowedPlatformPage, allowedPlatformResource, BookmarkReaderError, contentIdentity,
  isDefaultTitle, platformAccessBlock, platformForUrl, readerUrl, requiresPlatformLogin, validatePlatformPreview,
} from "./policy.ts";

type LoginSession = BookmarkLoginSession & {
  source: string;
  page: Page;
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
  metadata?: BookmarkMetadata;
};

export class BookmarkBrowserReader {
  private browser: Browser | undefined;
  private active = false;
  private headed = false;
  private login?: LoginSession;
  readonly directory: string;
  constructor(directory: string) { this.directory = directory; }

  async start(headed: boolean): Promise<void> {
    const runtime = resolve(this.directory, "runtime");
    await mkdir(runtime, { recursive: true, mode: 0o700 });
    process.env.TMPDIR = runtime;
    const executablePath = process.env.BOOKMARK_CHROME_EXECUTABLE_PATH ||
      (process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : "");
    if (!executablePath) throw new Error("请配置 BOOKMARK_CHROME_EXECUTABLE_PATH 指向已安装的 Chrome。");
    const env: Record<string, string> = { PATH: process.env.PATH ?? "", TMPDIR: runtime };
    for (const key of ["DISPLAY", "WAYLAND_DISPLAY", "XAUTHORITY", "XDG_RUNTIME_DIR", "LANG", "FONTCONFIG_PATH", "LD_LIBRARY_PATH"])
      if (process.env[key]) env[key] = process.env[key]!;
    this.browser = await puppeteer.launch({
      executablePath, userDataDir: resolve(this.directory, "profile"), headless: !headed,
      timeout: 12000, protocolTimeout: 35000, env,
      handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false,
      defaultViewport: { width: 1280, height: 800 },
    });
    this.headed = headed;
  }

  status() {
    return { connected: Boolean(this.browser?.connected), reading: this.active,
      loginPending: Boolean(this.login && !this.login.metadata), headed: this.headed };
  }

  private async page(platform: ReaderPlatform, background = true): Promise<Page> {
    if (!this.browser?.connected)
      throw new BookmarkReaderError("UNAVAILABLE", "浏览器读取服务已停止，请重新启动。", 503);
    const page = await this.browser.newPage({ background });
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    page.on("request", request => {
      const mainNavigation = request.isNavigationRequest() && request.frame() === page.mainFrame();
      const allowed = mainNavigation
        ? allowedPlatformPage(request.url(), platform)
        : allowedPlatformResource(request.url(), platform);
      const action = allowed ? request.continue() : request.abort();
      void action.catch(error => { if (!page.isClosed()) throw error; });
    });
    page.setDefaultNavigationTimeout(20000);
    return page;
  }

  private interactionError(code: string, message: string, platform: ReaderPlatform) {
    return new BookmarkReaderError(code, message, 422, platform.id, readerInteraction(false));
  }

  async openLogin(platformId = "xiaohongshu"): Promise<void> {
    const platform = READER_PLATFORMS.find(item => item.id === platformId);
    if (!platform) throw new BookmarkReaderError("INVALID_PLATFORM", "不支持这个平台。", 400);
    const page = await this.page(platform, false);
    await page.goto(platform.loginUrl, { waitUntil: "domcontentloaded" });
    await page.bringToFront();
  }

  async preview(value: string, signal: AbortSignal): Promise<BookmarkMetadata> {
    const source = readerUrl(value);
    const platform = platformForUrl(source)!;
    if (requiresPlatformLogin(source.href, platform))
      throw new BookmarkReaderError("INVALID_URL", "请提供需要收藏的内容链接。", 400);
    if (this.active) throw new BookmarkReaderError("BUSY", "正在读取另一条内容，请稍后重试。", 429);
    this.active = true;
    let page: Page | undefined;
    let observed: ReturnType<typeof observeDouyinMetadata> | undefined;
    const deadline = AbortSignal.any([signal, AbortSignal.timeout(35000)]);
    const closeOnAbort = () => { void page?.close(); };
    deadline.addEventListener("abort", closeOnAbort, { once: true });
    try {
      deadline.throwIfAborted();
      page = await this.page(platform);
      if (platform.id === "douyin") observed = observeDouyinMetadata(page);
      deadline.throwIfAborted();
      const response = await page.goto(source.href, { waitUntil: "domcontentloaded" });
      const visited = [...(response?.request().redirectChain().map(request => request.url()) ?? []), page.url()];
      const expected = contentIdentity(source.href, platform) ||
        visited.map(url => contentIdentity(url, platform)).find(Boolean);
      const until = Date.now() + 15000;
      while (true) {
        deadline.throwIfAborted();
        const block = platformAccessBlock(page.url(), platform);
        if (block) throw this.interactionError(block, block === "ACCESS_DENIED"
          ? `${platform.label}暂时拒绝访问，请打开页面检查平台提示。`
          : `${platform.label}需要完成页面验证。`, platform);
        if (requiresPlatformLogin(page.url(), platform) || response?.status() === 401)
          throw this.interactionError("LOGIN_REQUIRED", `${platform.label}需要登录，完成登录后将自动重新读取。`, platform);
        if (!allowedPlatformPage(page.url(), platform))
          throw this.interactionError("ACCESS_DENIED", "页面离开了原平台，读取已终止。", platform);
        const snapshot = await page.evaluate(inspectPlatformPage, platform);
        if (snapshot.verificationVisible)
          throw this.interactionError("VERIFICATION_REQUIRED", `${platform.label}需要完成页面验证。`, platform);
        const current = contentIdentity(page.url(), platform);
        const content = observed?.read(current) ?? snapshot;
        const hasTitle = !isDefaultTitle(content.title, platform);
        if (snapshot.loginVisible && (!hasTitle || !current || !snapshot.hasContent))
          throw this.interactionError("LOGIN_REQUIRED", `${platform.label}需要登录，完成登录后将自动重新读取。`, platform);
        if (response && !response.ok()) {
          if ([404, 410].includes(response.status()))
            throw new BookmarkReaderError("CONTENT_UNAVAILABLE", "目标内容已无法访问，请检查原链接。", 422, platform.id);
          throw this.interactionError("ACCESS_DENIED", `${platform.label}暂时拒绝访问，请打开页面检查。`, platform);
        }
        if (hasTitle && current && (!expected || expected === current) &&
            (content.cover_url || !["xiaohongshu", "douyin"].includes(platform.id))) {
          let metadata: BookmarkMetadata;
          try { metadata = validatePlatformPreview(content, platform); }
          catch (error) {
            if (needsBookmarkInteraction(error)) throw this.interactionError(error.code, error.message, platform);
            throw error;
          }
          if (contentIdentity(page.url(), platform) !== current)
            throw new BookmarkReaderError("CONTENT_CHANGED", "内容地址发生变化，请重新读取。", 422, platform.id);
          return metadata;
        }
        if (Date.now() >= until)
          throw this.interactionError("METADATA_MISSING", "未读取到原链接的实际内容，请打开平台页面检查。", platform);
        await delay(250, undefined, { signal: deadline });
      }
    } catch (error) {
      deadline.throwIfAborted();
      throw error;
    } finally {
      deadline.removeEventListener("abort", closeOnAbort);
      observed?.dispose();
      try { if (page && !page.isClosed()) await page.close(); }
      finally { this.active = false; }
    }
  }

  async startLogin(value: string, requestId: string, signal: AbortSignal): Promise<BookmarkLoginSession> {
    const source = readerUrl(value);
    const platform = platformForUrl(source)!;
    if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(requestId))
      throw new BookmarkReaderError("INVALID_REQUEST", "登录请求标识无效。", 400);
    if (requiresPlatformLogin(source.href, platform))
      throw new BookmarkReaderError("INVALID_URL", "请提供需要收藏的内容链接。", 400);
    if (this.login?.id === requestId && this.login.source === source.href) return this.sessionInfo(this.login);
    if (this.active || this.login)
      throw new BookmarkReaderError("BUSY", "已有内容正在读取或等待登录，请完成或取消后重试。", 429);
    const interaction = readerInteraction(true)!;
    this.active = true;
    let page: Page | undefined;
    const closeOnAbort = () => { void page?.close(); };
    signal.addEventListener("abort", closeOnAbort, { once: true });
    try {
      signal.throwIfAborted();
      if (!this.headed) {
        await this.browser?.close();
        await this.start(true);
      }
      signal.throwIfAborted();
      page = await this.page(platform, false);
      signal.throwIfAborted();
      await page.goto(source.href, { waitUntil: "domcontentloaded" });
      await page.bringToFront();
      signal.throwIfAborted();
      const expiresAt = Date.now() + 10 * 60 * 1000;
      const timer = setTimeout(() => { void this.cancelLogin(requestId); }, expiresAt - Date.now());
      timer.unref();
      this.login = { id: requestId, platform: platform.id, source: source.href,
        expiresAt, interaction, page, timer, controller: new AbortController() };
      return this.sessionInfo(this.login);
    } catch (error) {
      signal.throwIfAborted();
      throw error;
    } finally {
      signal.removeEventListener("abort", closeOnAbort);
      try { if (!this.login && page && !page.isClosed()) await page.close(); }
      finally { this.active = false; }
    }
  }

  private sessionInfo(session: LoginSession): BookmarkLoginSession {
    return { id: session.id, platform: session.platform, expiresAt: session.expiresAt, interaction: session.interaction };
  }

  async checkLogin(id: string, signal: AbortSignal): Promise<BookmarkLoginResult> {
    const session = this.login;
    if (!session || session.id !== id || session.expiresAt <= Date.now())
      throw new BookmarkReaderError("LOGIN_EXPIRED", "登录等待已结束，请重新打开平台页面。", 410);
    if (session.metadata) return { status: "ready", metadata: session.metadata };
    // 始终用原链接重新读取；关闭登录窗口不能作为登录成功的证据。
    try {
      const metadata = await this.preview(session.source, AbortSignal.any([signal, session.controller.signal]));
      if (this.login !== session) throw new BookmarkReaderError("LOGIN_EXPIRED", "登录等待已结束。", 410);
      session.metadata = metadata;
      if (!session.page.isClosed()) await session.page.close();
      return { status: "ready", metadata };
    } catch (error) {
      if (needsBookmarkInteraction(error) && session.page.isClosed())
        throw new BookmarkReaderError("LOGIN_WINDOW_CLOSED", "平台页面已关闭，尚未读取到内容，请重新打开。", 409);
      if (needsBookmarkInteraction(error) || (error instanceof BookmarkReaderError && error.code === "BUSY"))
        return { status: "pending" };
      throw error;
    }
  }

  async cancelLogin(id: string): Promise<void> {
    const session = this.login;
    if (!session || session.id !== id) return;
    this.login = undefined;
    clearTimeout(session.timer);
    session.controller.abort();
    if (!session.page.isClosed()) await session.page.close();
  }

  async close(): Promise<void> {
    if (this.login) await this.cancelLogin(this.login.id);
    if (this.browser?.connected) await this.browser.close();
  }
}
