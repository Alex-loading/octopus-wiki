import https from "node:https";
import { Readable } from "node:stream";
import { parse, type DefaultTreeAdapterMap } from "parse5";
import { parseBookmarkUrl } from "../../src/app/content/bookmarks.ts";

const PAGE_HOSTS = new Set(["xiaohongshu.com", "www.xiaohongshu.com", "m.xiaohongshu.com"]);
const SHARE_HOSTS = new Set(["xhslink.com", "www.xhslink.com", "xhslink.cn"]);
const NAVIGATION_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "Accept-Language": "zh-CN,zh;q=0.9",
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
  "Sec-CH-UA": '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
  "Sec-CH-UA-Mobile": "?0",
  "Sec-CH-UA-Platform": '"macOS"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  Priority: "u=0, i",
};

export function isXiaohongshuPage(url: URL): boolean {
  return PAGE_HOSTS.has(url.hostname);
}

export function isXiaohongshuUrl(url: URL): boolean {
  return isXiaohongshuPage(url) || SHARE_HOSTS.has(url.hostname);
}

export function xiaohongshuNoteId(url: URL): string {
  if (!isXiaohongshuPage(url) || url.protocol !== "https:" || url.port || url.username || url.password)
    throw new Error("请提供有效的小红书笔记链接。");
  if (/^\/(?:login|website-login)(?:\/|$)/i.test(url.pathname))
    throw new Error("小红书登录页无法用于读取笔记，请使用可访问的笔记链接。");
  const id = url.pathname.match(/^\/(?:explore|discovery\/item)\/([a-f\d]{24})\/?$/i)?.[1];
  if (!id) throw new Error("请提供包含笔记 ID 的小红书笔记链接。");
  return id.toLowerCase();
}

export function requestXiaohongshuPage(url: URL, signal: AbortSignal): Promise<Response> {
  xiaohongshuNoteId(url);
  return new Promise((resolve, reject) => {
    // 使用 HTTPS 客户端保留页面导航请求头，重定向由调用方逐次校验。
    const request = https.get(url, { signal, headers: NAVIGATION_HEADERS }, response => {
      const status = response.statusCode;
      if (!status || (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")) {
        response.destroy();
        reject(new Error("小红书返回了无法读取的页面响应。"));
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) value.forEach(item => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const body = [204, 205, 304].includes(status) ? null : Readable.toWeb(response) as ReadableStream<Uint8Array>;
      if (!body) response.resume();
      resolve(new Response(body, { status, headers }));
    });
    request.on("error", reject);
  });
}

export function parseXiaohongshuPreview(html: string, pageUrl: URL): { title: string; cover_url: string } {
  const expectedId = xiaohongshuNoteId(pageUrl);
  const metadata = new Map<string, string>();
  const nodes: DefaultTreeAdapterMap["node"][] = [parse(html)];
  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    if ("tagName" in node && node.tagName === "meta") {
      const attributes = new Map(node.attrs.map(attribute => [attribute.name, attribute.value]));
      const name = attributes.get("property") || attributes.get("name");
      const content = attributes.get("content");
      if (name && content) metadata.set(name.toLowerCase(), content);
    }
    if ("childNodes" in node) nodes.push(...node.childNodes);
  }
  const canonicalUrl = metadata.get("og:url");
  if (!canonicalUrl || xiaohongshuNoteId(parseBookmarkUrl(new URL(canonicalUrl, pageUrl).href)) !== expectedId)
    throw new Error("小红书返回的页面与目标笔记不一致。");
  const title = metadata.get("og:title")?.replace(/\s+/g, " ").trim();
  const image = metadata.get("og:image");
  if (!title || /^小红书(?:\s*[-–—|]\s*你的生活兴趣社区)?$/u.test(title) || !image)
    throw new Error("未读取到小红书笔记的真实标题和封面。");
  const cover = parseBookmarkUrl(new URL(image, pageUrl).href);
  if (!cover.hostname.endsWith(".xhscdn.com") || cover.port || !["http:", "https:"].includes(cover.protocol))
    throw new Error("小红书返回的图片无法作为笔记封面。");
  cover.protocol = "https:";
  return { title: title.slice(0, 300), cover_url: cover.href };
}
