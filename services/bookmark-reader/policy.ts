import { BookmarkPreviewError, type BookmarkMetadata } from "../../src/app/content/bookmarkPreview.ts";
import { READER_PLATFORMS, type ReaderPlatform } from "./platforms.ts";

export { BookmarkPreviewError as BookmarkReaderError } from "../../src/app/content/bookmarkPreview.ts";
const BookmarkReaderError = BookmarkPreviewError;

export function platformForUrl(value: string | URL): ReaderPlatform | undefined {
  if (!URL.canParse(String(value))) return undefined;
  const url = new URL(value);
  return READER_PLATFORMS.find(platform => platform.pageHosts.includes(url.hostname));
}

export function readerUrl(value: string): URL {
  if (!value || value.length > 4096 || /[\s\\]/u.test(value) || !URL.canParse(value))
    throw new BookmarkReaderError("INVALID_URL", "请提供有效的平台内容链接。", 400);
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || url.username || url.password || !platformForUrl(url))
    throw new BookmarkReaderError("INVALID_URL", "这个链接暂不支持自动读取，请手动填写标题和封面。", 400);
  return url;
}

export function allowedPlatformPage(value: string, platform: ReaderPlatform): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    [...platform.pageHosts, ...platform.authHosts].includes(url.hostname);
}

export function requiresPlatformLogin(value: string, platform: ReaderPlatform): boolean {
  if (!allowedPlatformPage(value, platform)) return false;
  const url = new URL(value);
  return platform.authHosts.includes(url.hostname) ||
    /^(?:\/(?:account|accounts|user|users|sso))?\/(?:login|signin|sign-in|passport|auth)(?:[/.]|$)/i.test(url.pathname);
}

export function platformAccessBlock(value: string, platform: ReaderPlatform): "ACCESS_DENIED" | "VERIFICATION_REQUIRED" | null {
  if (!allowedPlatformPage(value, platform)) return null;
  const url = new URL(value);
  if (platform.id === "xiaohongshu" && url.pathname.startsWith("/website-login/error")) return "ACCESS_DENIED";
  return /(?:^|\/)(?:captcha|verify|verification|wappoc_appmsgcaptcha)(?:[/.]|$)/i.test(url.pathname)
    ? "VERIFICATION_REQUIRED" : null;
}

export function allowedPlatformResource(value: string, platform: ReaderPlatform): boolean {
  if (value.startsWith("data:") || value.startsWith("blob:")) return true;
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === "https:" && !url.port && !url.username && !url.password &&
    platform.resourceDomains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
}

export function isDefaultTitle(title: string, platform: ReaderPlatform): boolean {
  return !title.trim() || platform.defaultTitle.test(title.trim()) ||
    /^(?:登录|注册|安全验证|访问验证|验证码|账号登录|用户登录|Sign in|Log in|Access denied)(?:\s*[-—|_]\s*[^\n]+)?$/iu.test(title.trim());
}

export function contentIdentity(value: string, platform: ReaderPlatform): string | null {
  if (!allowedPlatformPage(value, platform) || requiresPlatformLogin(value, platform)) return null;
  const url = new URL(value);
  if (platform.id === "xiaohongshu")
    return url.pathname.match(/^\/(?:explore|discovery\/item)\/([a-f\d]{24})\/?$/i)?.[1] ?? null;
  if (platform.id === "douyin")
    return url.pathname.match(/^\/(?:share\/)?(?:video|note)\/(\d{10,25})\/?$/)?.[1] ?? null;
  if (["b23.tv", "www.b23.tv"].includes(url.hostname)) return null;
  if (platform.id === "bilibili") {
    const id = url.pathname.match(/^\/(?:video|read|opus|dynamic)\/([^/]+)/)?.[1];
    if (id) return id;
  }
  if (url.pathname === "/" || requiresPlatformLogin(value, platform)) return null;
  if (platform.id === "wechat") {
    if (url.pathname !== "/s") return url.pathname;
    return ["__biz", "mid", "idx"].every(key => url.searchParams.has(key))
      ? ["__biz", "mid", "idx"].map(key => url.searchParams.get(key)).join(":") : null;
  }
  return `${url.hostname}${url.pathname.replace(/\/$/, "")}`;
}

export function validatePlatformPreview(value: unknown, platform: ReaderPlatform): BookmarkMetadata {
  if (platform.id === "xiaohongshu") return validateXiaohongshuPreview(value);
  if (!value || typeof value !== "object")
    throw new BookmarkReaderError("METADATA_MISSING", "页面未提供内容信息。", 422, platform.id);
  const metadata = value as Record<string, unknown>;
  const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
  if (isDefaultTitle(title, platform) || title.length > 300)
    throw new BookmarkReaderError("METADATA_MISSING", "未读取到实际内容标题。", 422, platform.id);
  const cover = typeof metadata.cover_url === "string" ? metadata.cover_url : "";
  if (cover && (!URL.canParse(cover) || !allowedPlatformResource(cover, platform) || !cover.startsWith("https://")))
    throw new BookmarkReaderError("METADATA_MISSING", "内容封面地址无效。", 422, platform.id);
  if (platform.id === "douyin" && !cover)
    throw new BookmarkReaderError("METADATA_MISSING", "未读取到视频封面。", 422, platform.id);
  return { title, cover_url: cover };
}

export function xiaohongshuUrl(value: string): URL {
  const url = readerUrl(value);
  if (!isXiaohongshuUrl(url))
    throw new BookmarkReaderError("INVALID_URL", "读取服务只接受小红书 HTTPS 链接。", 400);
  return url;
}

export function isXiaohongshuUrl(value: URL): boolean {
  return platformForUrl(value)?.id === "xiaohongshu";
}

export function noteId(value: string): string | null {
  const url = xiaohongshuUrl(value);
  return url.pathname.match(/^\/(?:explore|discovery\/item)\/([a-f\d]{24})\/?$/i)?.[1] ?? null;
}

export function requiresXiaohongshuLogin(value: string): boolean {
  return /^\/(?:login|signin)(?:\/|$)/i.test(xiaohongshuUrl(value).pathname);
}

export function allowedXiaohongshuResource(value: string): boolean {
  return allowedPlatformResource(value, READER_PLATFORMS.find(platform => platform.id === "xiaohongshu")!);
}

export function validateXiaohongshuPreview(value: unknown): { title: string; cover_url: string } {
  if (!value || typeof value !== "object")
    throw new BookmarkReaderError("METADATA_MISSING", "小红书页面未返回笔记信息，请在读取服务浏览器中检查页面。");
  const metadata = value as Record<string, unknown>;
  const title = typeof metadata.title === "string" ? metadata.title.trim() : "";
  if (!title || title.length > 300 || /^小红书(?:\s*[-—|]\s*你的生活兴趣社区)?$/u.test(title))
    throw new BookmarkReaderError("METADATA_MISSING", "未读取到实际笔记标题，请在读取服务浏览器中检查页面。");
  if (typeof metadata.cover_url !== "string" || !metadata.cover_url ||
      metadata.cover_url.length > 4096 || !URL.canParse(metadata.cover_url))
    throw new BookmarkReaderError("METADATA_MISSING", "未读取到实际笔记封面，请在读取服务浏览器中检查页面。");
  const cover = new URL(metadata.cover_url);
  if (cover.protocol === "http:" && cover.hostname.endsWith(".xhscdn.com")) cover.protocol = "https:";
  if (cover.protocol !== "https:" || cover.port || cover.username || cover.password ||
      !cover.hostname.endsWith(".xhscdn.com"))
    throw new BookmarkReaderError("METADATA_MISSING", "笔记封面地址无效。");
  return { title, cover_url: cover.href };
}
