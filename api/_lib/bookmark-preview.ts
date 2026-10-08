import { parseBookmarkUrl } from "../../src/app/content/bookmarks.ts";
import { parse, type DefaultTreeAdapterTypes } from "parse5";
import { douyinVideoPage } from "./douyin-render-policy.ts";
import { isXiaohongshuUrl, isDefaultTitle, platformForUrl, readerUrl, requiresPlatformLogin } from "../../services/bookmark-reader/policy.ts";
import { readBookmarkPreview } from "./bookmark-browser-client.ts";

export function allowedPreviewUrl(value: string): URL {
  return readerUrl(value);
}
export function isPlaceholderCover(value: string): boolean {
  try {
    const url = new URL(value);
    return url.hostname === "picasso-static.xiaohongshu.com" && url.pathname.startsWith("/fe-platform/");
  } catch { return false; }
}
export async function readBoundedText(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (Number(response.headers.get("content-length")) > maxBytes) {
    await response.body?.cancel();
    throw new Error("响应内容过大。");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("响应内容过大。");
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    await reader.cancel().catch(() => {});
  }
}
async function readHtmlHead(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let size = 0,
    text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      const remaining = maxBytes - size;
      const inspected = value.subarray(0, Math.max(0, remaining));
      size += inspected.byteLength;
      text += decoder.decode(inspected, { stream: true });
      const end = /<\/head\s*>/i.exec(text);
      if (end) return text.slice(0, end.index + end[0].length);
      if (inspected.byteLength < value.byteLength || size >= maxBytes)
        throw new Error("响应内容过大。");
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export function parsePreviewHtml(
  html: string,
  pageUrl: string,
): { title: string; cover_url: string } {
  const values = new Map<string, string>();
  let documentTitle = "";
  const visit = (node: DefaultTreeAdapterTypes.Node) => {
    if ("tagName" in node && node.tagName === "meta") {
      const attrs = new Map(node.attrs.map(attr => [attr.name, attr.value]));
      const name = attrs.get("property") || attrs.get("name");
      if (name && attrs.get("content")) values.set(name.toLowerCase(), attrs.get("content")!);
    }
    if ("tagName" in node && node.tagName === "title")
      documentTitle = node.childNodes.filter(child => child.nodeName === "#text")
        .map(child => (child as DefaultTreeAdapterTypes.TextNode).value).join("");
    if ("childNodes" in node) node.childNodes.forEach(visit);
  };
  visit(parse(html));
  const title = (
    values.get("og:title") ||
    values.get("twitter:title") ||
    values.get("lark:url:video_title") ||
    documentTitle
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  let cover_url = "";
  const cover =
    values.get("og:image") ||
    values.get("twitter:image") ||
    values.get("lark:url:video_cover_image_url");
  try {
    if (cover) {
      const url = parseBookmarkUrl(new URL(cover, pageUrl).href);
      // 小红书 CDN 图片支持 HTTPS，保留原有图片路径及签名。
      if (
        url.protocol === "http:" &&
        !url.port &&
        url.hostname.endsWith(".xhscdn.com")
      )
        url.protocol = "https:";
      if (
        url.protocol === "https:" &&
        !isPlaceholderCover(url.href) &&
        /[a-z]/i.test(url.hostname) &&
        url.hostname.includes(".") &&
        !/\.(local|localhost|internal)$/i.test(url.hostname)
      )
        cover_url = url.href;
    }
  } catch {
    /* 封面选填，无法解析的地址不作为封面。 */
  }
  return { title, cover_url };
}
export async function fetchBookmarkPreview(
  value: string,
  fetcher: typeof fetch = fetch,
  render: (url: string, signal?: AbortSignal) => Promise<{ title: string; cover_url: string }> = readBookmarkPreview,
  requestSignal?: AbortSignal,
): Promise<{ title: string; cover_url: string }> {
  let url = allowedPreviewUrl(value);
  const source = url.href;
  const platform = platformForUrl(url)!;
  const signal = AbortSignal.any([AbortSignal.timeout(6500), ...(requestSignal ? [requestSignal] : [])]);
  for (let step = 0; step <= 4; step++) {
    if (isXiaohongshuUrl(url)) return readBookmarkPreview(source, requestSignal);
    const response = await fetcher(url, {
      redirect: "manual",
      signal,
      headers: {
        Accept: "text/html",
        "User-Agent": url.hostname === "mp.weixin.qq.com"
          ? "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
          : "OctopusWiki-LinkPreview/1.0",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || step === 4)
        throw new Error("短链接跳转过多，请粘贴原页面链接或手动填写。");
      const destination = new URL(location, url).href;
      if (requiresPlatformLogin(destination, platform)) return readBookmarkPreview(source, requestSignal);
      url = allowedPreviewUrl(destination);
      if (platformForUrl(url)?.id !== platform.id) throw new Error("链接跳转到了其他平台，请检查原链接。");
      continue;
    }
    if ([401, 403, 412].includes(response.status)) {
      await response.body?.cancel();
      return readBookmarkPreview(source, requestSignal);
    }
    if (
      !response.ok ||
      !response.headers.get("content-type")?.toLowerCase().includes("text/html")
    ) {
      await response.body?.cancel();
      throw new Error("平台暂时无法读取，可以手动填写标题和封面后保存。");
    }
    const preview = parsePreviewHtml(
      await readHtmlHead(response, 512 * 1024),
      url.href,
    );
    if ((!preview.title || !preview.cover_url) && douyinVideoPage(url.href)) {
      const rendered = await render(url.href, requestSignal);
      return {
        title: rendered.title || preview.title,
        cover_url: rendered.cover_url || preview.cover_url,
      };
    }
    if (isDefaultTitle(preview.title, platform) || requiresPlatformLogin(url.href, platform))
      return readBookmarkPreview(source, requestSignal);
    return preview;
  }
  throw new Error("链接暂时无法读取。");
}
