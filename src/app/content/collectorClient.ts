import { getSupabaseClient } from "./repository";
import { previewResponseError, type BookmarkMetadata, type BookmarkLoginSession, type BookmarkLoginResult } from "./bookmarkPreview";
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
  signal?: AbortSignal,
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
    signal: AbortSignal.any([AbortSignal.timeout(body?.action === "create-bookmark" ? 90000 :
      ["preview", "login-start", "login-check"].includes(String(body?.action)) ? 60000 : 15000), ...(signal ? [signal] : [])]),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success)
    throw previewResponseError(result, response.status);
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
  preview: (url: string, signal?: AbortSignal) =>
    request<BookmarkMetadata>({ action: "preview", url }, false, signal),
  startLogin: (url: string, requestId: string, signal?: AbortSignal) =>
    request<BookmarkLoginSession>({ action: "login-start", url, requestId }, false, signal),
  checkLogin: (sessionId: string, signal?: AbortSignal) =>
    request<BookmarkLoginResult>({ action: "login-check", sessionId }, false, signal),
  cancelLogin: (sessionId: string) => request<void>({ action: "login-cancel", sessionId }),
};
