import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ReaderInteraction } from "../../src/app/content/bookmarkPreview.ts";
import { BookmarkPreviewError } from "../../src/app/content/bookmarkPreview.ts";

export function readerInteraction(required: boolean): ReaderInteraction | undefined {
  const value = process.env.BOOKMARK_BROWSER_LOGIN_URL;
  if (value) {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("BOOKMARK_BROWSER_LOGIN_URL 必须是远程浏览器的 HTTPS 地址。");
    if (required && process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY)
      throw new BookmarkPreviewError("INTERACTION_UNAVAILABLE", "读取主机尚未连接可交互桌面，请联系管理员。", 503);
    return { mode: "remote", url: url.href };
  }
  if (process.platform === "darwin" || process.platform === "win32") return { mode: "local" };
  if (required) throw new BookmarkPreviewError("INTERACTION_UNAVAILABLE", "读取服务尚未配置远程登录入口，请联系管理员。", 503);
  return undefined;
}

export function readerDataDirectory(): string {
  return resolve(process.env.BOOKMARK_BROWSER_DATA_DIR || ".local/bookmark-reader");
}

export function readerPort(): number {
  const port = Number(process.env.BOOKMARK_BROWSER_READER_PORT || 4318);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("BOOKMARK_BROWSER_READER_PORT 无效。");
  return port;
}

export async function readerToken(create = false): Promise<string> {
  const configured = process.env.BOOKMARK_BROWSER_READER_TOKEN;
  if (configured) {
    if (configured.length < 32 || /\s/u.test(configured)) throw new Error("读取服务令牌必须至少包含 32 个字符且不含空白。");
    return configured;
  }
  if (process.env.VERCEL) throw new Error("请配置 BOOKMARK_BROWSER_READER_TOKEN。");
  const directory = readerDataDirectory();
  const filename = resolve(directory, "access-token");
  if (create) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if (!existsSync(filename))
      await writeFile(filename, randomBytes(32).toString("base64url"), { flag: "wx", mode: 0o600 });
  }
  if (!existsSync(filename)) throw new Error("请运行 npm run bookmarks:reader，启动平台内容读取服务。");
  const token = (await readFile(filename, "utf8")).trim();
  if (token.length < 32 || /\s/u.test(token)) throw new Error("读取服务令牌文件无效。");
  return token;
}

export function readerBaseUrl(): URL {
  const configured = process.env.BOOKMARK_BROWSER_READER_URL;
  if (!configured && process.env.VERCEL) throw new Error("请配置 BOOKMARK_BROWSER_READER_URL，连接平台内容读取服务。");
  const url = new URL(configured || `http://127.0.0.1:${readerPort()}`);
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname);
  if ((!local && url.protocol !== "https:") || !["http:", "https:"].includes(url.protocol) ||
      url.username || url.password || url.search || url.hash || !/^\/$/.test(url.pathname))
    throw new Error("读取服务地址必须是 HTTPS 服务根地址；本机地址允许 HTTP。");
  if (configured && !local && !process.env.BOOKMARK_BROWSER_READER_TOKEN)
    throw new Error("远程读取服务需要配置 BOOKMARK_BROWSER_READER_TOKEN。");
  return url;
}
