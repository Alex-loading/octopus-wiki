import { getSupabaseClient, getUserRoleState } from "./repository";
import {
  validateBookmarkDraft,
  validateCollectionDraft,
  type Bookmark,
  type BookmarkCollection,
  type BookmarkDraft,
  type CollectionDraft,
} from "./bookmarks";

function client() {
  const value = getSupabaseClient();
  if (!value)
    throw new Error("收藏服务尚未配置，请配置 Supabase 并应用收藏数据库迁移。");
  return value;
}
async function adminClient() {
  const db = client();
  const role = await getUserRoleState();
  if (!role.authenticated || !role.isAdmin)
    throw new Error("请先登录管理员账号。");
  return db;
}
function fail(
  error: { code?: string; message?: string } | null,
  collection = false,
): void {
  if (!error) return;
  if (error.code === "23505")
    throw new Error(
      collection
        ? "已有同名收藏箱，请选择它或使用其他名称。"
        : "这条链接已经收藏过，请到收藏管理中查看或移动。",
    );
  if (["23503", "23001"].includes(error.code ?? ""))
    throw new Error(
      collection
        ? "收藏箱还有资源，请先移动或删除资源。"
        : "收藏箱已不存在，请重新选择。",
    );
  if (["42P01", "PGRST205"].includes(error.code ?? ""))
    throw new Error("收藏数据表尚未创建，请先应用 007_bookmarks.sql 迁移。");
  if (error.code === "42501")
    throw new Error("没有操作权限，请重新登录管理员账号。");
  throw new Error(error.message || "收藏服务暂时不可用，请稍后重试。");
}

export async function listBookmarkCollections(
  admin = false,
): Promise<BookmarkCollection[]> {
  const db = admin ? await adminClient() : client();
  let query = db
    .from("bookmark_collections")
    .select("*")
    .order("sort_order")
    .order("created_at");
  if (!admin) query = query.eq("is_public", true);
  const { data, error } = await query;
  fail(error);
  return data ?? [];
}
export async function listBookmarks(
  options: { admin?: boolean; collectionId?: string } = {},
): Promise<Bookmark[]> {
  const db = options.admin ? await adminClient() : client();
  // Explicit public predicates keep the public page identical while an admin is logged in.
  const output: Bookmark[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = db
      .from("bookmarks")
      .select("*, bookmark_collections!inner(is_public)")
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + 499);
    if (!options.admin)
      query = query
        .eq("is_public", true)
        .eq("bookmark_collections.is_public", true);
    if (options.collectionId)
      query = query.eq("collection_id", options.collectionId);
    const { data, error } = await query;
    fail(error);
    output.push(...((data ?? []) as Bookmark[]));
    if (!data || data.length < 500) return output;
  }
}
export async function saveBookmark(
  draft: BookmarkDraft,
  id?: string,
): Promise<Bookmark> {
  const payload = validateBookmarkDraft(draft);
  const db = await adminClient();
  const query = id
    ? db.from("bookmarks").update(payload).eq("id", id)
    : db.from("bookmarks").insert(payload);
  const { data, error } = await query.select("*").single();
  fail(error);
  return data as Bookmark;
}
export async function saveBookmarkCollection(
  draft: CollectionDraft,
  id?: string,
): Promise<BookmarkCollection> {
  const payload = validateCollectionDraft(draft);
  const db = await adminClient();
  const query = id
    ? db.from("bookmark_collections").update(payload).eq("id", id)
    : db.from("bookmark_collections").insert(payload);
  const { data, error } = await query.select("*").single();
  fail(error, true);
  return data as BookmarkCollection;
}
export async function deleteBookmark(id: string): Promise<void> {
  const db = await adminClient();
  const { data, error } = await db
    .from("bookmarks")
    .delete()
    .eq("id", id)
    .select("id");
  fail(error);
  if (!data?.length)
    throw new Error("资源不存在或没有删除权限，请刷新后重试。");
}
export async function deleteBookmarkCollection(id: string): Promise<void> {
  const db = await adminClient();
  const { data, error } = await db
    .from("bookmark_collections")
    .delete()
    .eq("id", id)
    .select("id");
  fail(error, true);
  if (!data?.length)
    throw new Error("收藏箱不存在或没有删除权限，请刷新后重试。");
}
export async function previewBookmark(
  url: string,
): Promise<{ title: string; cover_url: string }> {
  const db = await adminClient();
  const { data, error } = await db.auth.getSession();
  if (error || !data.session) throw new Error("请先登录管理员账号。");
  const response = await fetch("/api/bookmark-preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success)
    throw new Error(
      result?.message || "暂时无法读取标题和封面，可以手动填写后保存。",
    );
  return result.data;
}
