import { getSupabaseClient } from "./repository";
import {
  validateBookmarkDraft,
  validateCollectionDraft,
  type Bookmark,
  type BookmarkCollection,
  type BookmarkDraft,
  type CollectionDraft,
} from "./bookmarks";

export type CollectorAccess =
  | { authorized: false }
  | { authorized: true; expiresAt: string; collections: BookmarkCollection[] };

async function request<T>(
  body?: Record<string, unknown>,
  admin = false,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (admin) {
    const client = getSupabaseClient();
    const session = client ? await client.auth.getSession() : null;
    if (session?.error || !session?.data.session)
      throw new Error("请先登录管理员账号。");
    headers.Authorization = `Bearer ${session.data.session.access_token}`;
  }
  const response = await fetch("/api/collector", {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success)
    throw new Error(
      result?.message ||
        "免登录收藏服务暂不可用，请确认已部署收藏 API 后重试。",
    );
  return result.data as T;
}
export const getCollectorAccess = () => request<CollectorAccess>();
export const authorizeCollector = () =>
  request<CollectorAccess>({ action: "authorize" }, true);
export const revokeCollector = (all = false) =>
  request<CollectorAccess>(
    { action: all ? "revoke-all" : "revoke-current" },
    all,
  );
export const collectorActions = {
  async save(draft: BookmarkDraft, id?: string) {
    if (id) throw new Error("修改已有收藏需要管理员登录。");
    validateBookmarkDraft(draft);
    return request<Bookmark>({ action: "create-bookmark", draft });
  },
  async createCollection(draft: CollectionDraft) {
    return request<BookmarkCollection>({
      action: "create-collection",
      draft: validateCollectionDraft(draft),
    });
  },
  preview: (url: string) =>
    request<{ title: string; cover_url: string }>({ action: "preview", url }),
};
