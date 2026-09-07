export type ArticleComment = {
  id: string;
  articleId: string;
  authorName: string;
  content: string;
  createdAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const VISITOR_ID_KEY = "octopus-wiki-article-visitor-id";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ArticleLikeState = {
  likeCount: number;
  liked: boolean;
};

export function formatArticleDateTime(value: string): string {
  const normalized = value.trim();
  if (!normalized) return "";
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!match) return normalized;
  return match[2] ? `${match[1]} ${match[2]}` : match[1];
}

export function normalizeCommentAuthor(value: string): string {
  const normalized = value.trim();
  return normalized ? [...normalized].slice(0, 40).join("") : "匿名";
}

export function normalizeCommentContent(value: string): string {
  return [...value.trim()].slice(0, 1000).join("");
}

export function commentAvatar(authorName: string): string {
  const normalized = normalizeCommentAuthor(authorName);
  return ([...normalized][0] ?? "匿").toUpperCase();
}

export function parseArticleLikeState(
  data: unknown,
  fallbackLikeCount = 0,
): ArticleLikeState {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") {
    return { likeCount: Math.max(0, fallbackLikeCount), liked: false };
  }

  const rawCount = "like_count" in row ? Number(row.like_count) : fallbackLikeCount;
  return {
    likeCount: Number.isFinite(rawCount) ? Math.max(0, Math.trunc(rawCount)) : Math.max(0, fallbackLikeCount),
    liked: "liked" in row && row.liked === true,
  };
}

export function getOrCreateArticleVisitorId(
  storage: StorageLike = window.localStorage,
  createId: () => string = () => crypto.randomUUID(),
): string {
  const stored = storage.getItem(VISITOR_ID_KEY)?.trim() ?? "";
  if (UUID_PATTERN.test(stored)) return stored;

  const visitorId = createId();
  if (!UUID_PATTERN.test(visitorId)) {
    throw new Error("无法创建有效的匿名访客标识。");
  }
  storage.setItem(VISITOR_ID_KEY, visitorId);
  return visitorId;
}
