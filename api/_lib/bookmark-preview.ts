import { parseBookmarkUrl } from "../../src/app/content/bookmarks.ts";

const PREVIEW_HOSTS = new Set([
  "bilibili.com",
  "www.bilibili.com",
  "m.bilibili.com",
  "space.bilibili.com",
  "b23.tv",
  "www.b23.tv",
  "douyin.com",
  "www.douyin.com",
  "v.douyin.com",
  "www.iesdouyin.com",
  "www.xiaohongshu.com",
  "xiaohongshu.com",
  "m.xiaohongshu.com",
  "xhslink.com",
  "www.xhslink.com",
  "nowcoder.com",
  "www.nowcoder.com",
  "m.nowcoder.com",
  "ac.nowcoder.com",
]);
export function allowedPreviewUrl(value: string): URL {
  const url = parseBookmarkUrl(value);
  if (url.protocol !== "https:" || url.port || !PREVIEW_HOSTS.has(url.hostname))
    throw new Error("这个链接暂不支持自动读取，请手动填写标题和封面。");
  return url;
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
function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,
    (match, entity: string) => {
      const names: Record<string, string> = {
        amp: "&",
        quot: '"',
        apos: "'",
        lt: "<",
        gt: ">",
        nbsp: " ",
      };
      if (!entity.startsWith("#")) return names[entity.toLowerCase()] ?? match;
      const n =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
    },
  );
}
export function parsePreviewHtml(
  html: string,
  pageUrl: string,
): { title: string; cover_url: string } {
  const values = new Map<string, string>();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(
      /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
    )) {
      attrs.set(
        match[1].toLowerCase(),
        decodeEntities(match[2] ?? match[3] ?? match[4]),
      );
    }
    const name = attrs.get("property") || attrs.get("name");
    if (name && attrs.get("content"))
      values.set(name.toLowerCase(), attrs.get("content")!);
  }
  const title = (
    values.get("og:title") ||
    values.get("twitter:title") ||
    decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
  )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  let cover_url = "";
  const cover = values.get("og:image") || values.get("twitter:image");
  try {
    if (cover) {
      const url = parseBookmarkUrl(new URL(cover, pageUrl).href);
      if (
        url.protocol === "https:" &&
        /[a-z]/i.test(url.hostname) &&
        url.hostname.includes(".") &&
        !/\.(local|localhost|internal)$/i.test(url.hostname)
      )
        cover_url = url.href;
    }
  } catch {
    /* Missing or malformed covers remain optional. */
  }
  return { title, cover_url };
}
export async function fetchBookmarkPreview(
  value: string,
  fetcher: typeof fetch = fetch,
): Promise<{ title: string; cover_url: string }> {
  let url = allowedPreviewUrl(value);
  const signal = AbortSignal.timeout(6500);
  for (let step = 0; step <= 4; step++) {
    const response = await fetcher(url, {
      redirect: "manual",
      signal,
      headers: {
        Accept: "text/html",
        "User-Agent": "OctopusWiki-LinkPreview/1.0",
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || step === 4)
        throw new Error("短链接跳转过多，请粘贴原页面链接或手动填写。");
      url = allowedPreviewUrl(new URL(location, url).href);
      continue;
    }
    if (
      !response.ok ||
      !response.headers.get("content-type")?.toLowerCase().includes("text/html")
    ) {
      await response.body?.cancel();
      throw new Error("平台暂时无法读取，可以手动填写标题和封面后保存。");
    }
    const preview = parsePreviewHtml(
      await readBoundedText(response, 512 * 1024),
      url.href,
    );
    if (!preview.title && !preview.cover_url)
      throw new Error("未读取到标题或封面，可以手动填写后保存。");
    return preview;
  }
  throw new Error("链接暂时无法读取。");
}
