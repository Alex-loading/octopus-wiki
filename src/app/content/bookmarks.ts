export const PLATFORMS = {
  bilibili: { label: "bilibili", mark: "B", color: "#D45B87" },
  douyin: { label: "抖音", mark: "抖", color: "#506873" },
  xiaohongshu: { label: "小红书", mark: "红", color: "#D34E50" },
  nowcoder: { label: "牛客", mark: "牛", color: "#32916C" },
  other: { label: "其他", mark: "↗", color: "#7776A7" },
} as const;
export type BookmarkPlatform = keyof typeof PLATFORMS;
export type BookmarkCollection = {
  id: string;
  name: string;
  description: string;
  is_public: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};
export type Bookmark = {
  id: string;
  collection_id: string;
  url: string;
  canonical_url: string;
  title: string;
  cover_url: string;
  note: string;
  platform: BookmarkPlatform;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};
export type BookmarkDraft = Pick<
  Bookmark,
  "collection_id" | "url" | "title" | "cover_url" | "note" | "is_public"
>;
export type CollectionDraft = Pick<
  BookmarkCollection,
  "name" | "description" | "is_public" | "sort_order"
>;
export const emptyBookmark = (): BookmarkDraft => ({
  collection_id: "",
  url: "",
  title: "",
  cover_url: "",
  note: "",
  is_public: true,
});

export function parseBookmarkUrl(value: string): URL {
  const text = value.trim();
  if (!text || text.length > 4096 || /[\s\\]/u.test(text))
    throw new Error("请输入有效的 HTTP 或 HTTPS 链接（最长 4096 字符）。");
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error("请输入完整的 HTTP 或 HTTPS 链接。");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error("只支持不含账号密码的 HTTP 或 HTTPS 链接。");
  return url;
}

export function extractBookmarkUrls(text: string): string[] {
  return [
    ...new Set(
      (text.match(/https?:\/\/[^\s<>"'\[\]\u3000，。！？、；“”‘’【】]+/giu) ?? [])
        .map((value) => value.replace(/[)）\]】,.;!?]+$/u, ""))
        .filter((value) => {
          try {
            parseBookmarkUrl(value);
            return true;
          } catch {
            return false;
          }
        }),
    ),
  ];
}

export function parseBookmarkShare(text: string): {
  urls: string[];
  title: string;
} {
  const urls = extractBookmarkUrls(text);
  if (urls.length !== 1) return { urls, title: "" };
  // Only use the text before the link: app slogans and copy codes follow it.
  let title = text.slice(0, text.indexOf(urls[0])).trim();
  if (identifyPlatform(urls[0]) === "douyin") {
    title = title
      .replace(/^(?:\d+(?:\.\d+)?\s+)?复制打开抖音[，,]?\s*(?:看看)?/u, "")
      .replace(/^【[^】]*的作品】/u, "");
  }
  return {
    urls,
    title: title
      .replace(/[\s[（(]+$/u, "")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, 300),
  };
}

export function identifyPlatform(value: string): BookmarkPlatform {
  let host: string;
  try {
    host = parseBookmarkUrl(value).hostname.toLowerCase();
  } catch {
    return "other";
  }
  const matches = (domains: string[]) =>
    domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  if (matches(["bilibili.com", "b23.tv"])) return "bilibili";
  if (matches(["douyin.com", "iesdouyin.com"])) return "douyin";
  if (matches(["xiaohongshu.com", "xhslink.com", "xhslink.cn"]))
    return "xiaohongshu";
  if (matches(["nowcoder.com"])) return "nowcoder";
  return "other";
}

export function canonicalBookmarkUrl(value: string): string {
  const url = parseBookmarkUrl(value);
  // Preserve tokens, content parameters, order and fragments needed by the original site.
  const tracking =
    /^(utm_[a-z_]+|spm_id_from|vd_source|share_source|share_medium|share_from|share_from_uid|share_times)$/i;
  const removed = [...url.searchParams.keys()].filter((key) =>
    tracking.test(key),
  );
  for (const key of removed) url.searchParams.delete(key);
  return url.href;
}

export function validateBookmarkDraft(draft: BookmarkDraft) {
  if (!/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(draft.collection_id))
    throw new Error("请选择一个收藏箱。");
  parseBookmarkUrl(draft.url);
  const title = draft.title.trim();
  if (!title || title.length > 300)
    throw new Error("请填写标题（最多 300 字）。");
  if (draft.cover_url.trim()) parseBookmarkUrl(draft.cover_url);
  if (draft.note.length > 2000) throw new Error("备注最多 2000 字。");
  return {
    collection_id: draft.collection_id,
    is_public: draft.is_public,
    title,
    url: draft.url.trim(),
    cover_url: draft.cover_url.trim(),
    note: draft.note.trim(),
    canonical_url: canonicalBookmarkUrl(draft.url),
    platform: identifyPlatform(draft.url),
  };
}

export function validateCollectionDraft(
  draft: CollectionDraft,
): CollectionDraft {
  const name = draft.name.trim();
  if (!name || name.length > 80) throw new Error("收藏箱名称需为 1–80 字。");
  if (draft.description.length > 500)
    throw new Error("收藏箱说明最多 500 字。");
  if (
    !Number.isInteger(draft.sort_order) ||
    Math.abs(draft.sort_order) > 1000000
  )
    throw new Error("排序值需为 -1000000 到 1000000 之间的整数。");
  return {
    name,
    description: draft.description.trim(),
    is_public: draft.is_public,
    sort_order: draft.sort_order,
  };
}

export function captureFromSearch(search: string): {
  draft: BookmarkDraft;
  text: string;
} {
  const params = new URLSearchParams(search);
  const text = (params.get("text") ?? "").slice(0, 6000);
  const sharedTitle = (params.get("title") ?? "").trim();
  const source = params.get("url") || text || sharedTitle;
  const shared = parseBookmarkShare(source);
  const links = shared.urls;
  const title = (
    sharedTitle && !extractBookmarkUrls(sharedTitle).length
      ? sharedTitle
      : shared.title
  ).slice(0, 300);
  const cover = params.get("cover") ?? "";
  let cover_url = "";
  try {
    if (cover) cover_url = parseBookmarkUrl(cover).href;
  } catch {
    /* Optional metadata. */
  }
  return {
    draft: {
      ...emptyBookmark(),
      url: links.length === 1 ? links[0] : "",
      title,
      cover_url,
    },
    text: source,
  };
}

export function createBookmarklet(origin: string): string {
  const target = new URL("/collect", parseBookmarkUrl(origin)).href;
  return `javascript:(()=>{const u=new URL(${JSON.stringify(target)});const m=(...names)=>names.map(n=>document.querySelector('meta[property="'+n+'"],meta[name="'+n+'"]')?.content).find(Boolean);u.searchParams.set('url',location.href);u.searchParams.set('title',(m('og:title','twitter:title','lark:url:video_title')||document.title).slice(0,300));const c=m('og:image','twitter:image','lark:url:video_cover_image_url');if(c){try{u.searchParams.set('cover',new URL(c,location.href).href)}catch{}}window.open(u.href,'octopus-collector');})()`;
}
