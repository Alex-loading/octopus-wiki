import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateBookmarkDraft, type Bookmark } from "../../src/app/content/bookmarks.ts";
import { archiveBookmarkCover, prepareBookmarkCover } from "./bookmark-cover.ts";

export class BookmarkSaveError extends Error {
  constructor(message: string, public readonly status = 400) { super(message); }
}
export function bookmarkServerClient(): SupabaseClient {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key) throw new BookmarkSaveError("收藏服务尚未配置。", 503);
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function validateSaveInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BookmarkSaveError("收藏内容格式错误。");
  const draft = value as Record<string, unknown>;
  if (["collection_id", "url", "title", "cover_url", "note"].some(key => typeof draft[key] !== "string") ||
      typeof draft.is_public !== "boolean") throw new BookmarkSaveError("收藏内容格式错误。");
  try { return validateBookmarkDraft(draft as Parameters<typeof validateBookmarkDraft>[0]); }
  catch (error) { throw new BookmarkSaveError(error instanceof Error ? error.message : "收藏内容格式错误。"); }
}
export async function saveStoredBookmark(
  client: SupabaseClient,
  payload: ReturnType<typeof validateBookmarkDraft>,
  id?: string,
  archive = (url: string, page: string) => archiveBookmarkCover(client, url, page),
): Promise<Bookmark> {
  let existing: Bookmark | null = null;
  if (id) {
    const { data, error } = await client.from("bookmarks").select("*").eq("id", id).maybeSingle();
    if (error) throw new BookmarkSaveError("读取原收藏失败，请稍后重试。", 503);
    if (!data) throw new BookmarkSaveError("收藏已不存在，请刷新后重试。", 404);
    existing = data as Bookmark;
  }
  let stored;
  try { stored = await prepareBookmarkCover(payload, existing, archive); }
  catch (error) { throw new BookmarkSaveError(error instanceof Error ? error.message : "封面转存失败。", 422); }
  const query = id ? client.from("bookmarks").update(stored).eq("id", id) : client.from("bookmarks").insert(stored);
  const { data, error } = await query.select("*").single();
  if (error) {
    if (error.code === "23505") throw new BookmarkSaveError("这条链接已经收藏过，请到收藏管理中查看或移动。", 409);
    if (error.code === "23503") throw new BookmarkSaveError("收藏箱已不存在，请重新选择。", 409);
    throw new BookmarkSaveError("收藏保存失败，请确认已应用 010 数据库迁移，或稍后重试。", 503);
  }
  return data as Bookmark;
}
