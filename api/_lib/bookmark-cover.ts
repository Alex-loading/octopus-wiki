import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { downloadCover } from "./cover-download.ts";
import { fetchBookmarkPreview, isPlaceholderCover } from "./bookmark-preview.ts";

export const COVER_BUCKET = "bookmark-covers";

export async function prepareBookmarkCover<T extends { cover_url: string; url: string }>(
  payload: T,
  existing: { cover_url: string; cover_storage_path?: string } | null,
  archive: (url: string, page: string) => Promise<string>,
): Promise<T & { cover_storage_path: string }> {
  const path = !payload.cover_url ? ""
    : existing?.cover_url === payload.cover_url && existing.cover_storage_path
      ? existing.cover_storage_path : await archive(payload.cover_url, payload.url);
  return { ...payload, cover_storage_path: path };
}

export async function archiveBookmarkCover(client: SupabaseClient, source: string, page: string, dependencies = {
  download: downloadCover, preview: fetchBookmarkPreview,
}): Promise<string> {
  let image: Awaited<ReturnType<typeof downloadCover>>;
  try {
    if (isPlaceholderCover(source)) throw new Error("平台默认图不是资源封面。");
    image = await dependencies.download(source);
  } catch {
    // Expired URLs can only be recovered from fresh metadata, never by editing a signature.
    const fresh = await dependencies.preview(page).catch(() => null);
    if (!fresh?.cover_url || fresh.cover_url === source || isPlaceholderCover(fresh.cover_url))
      throw new Error("封面已失效或无法下载，请重新读取、更换封面，或清空封面后保存。");
    image = await dependencies.download(fresh.cover_url);
  }
  const path = `${createHash("sha256").update(image.bytes).digest("hex")}.${image.extension}`;
  const { error } = await client.storage.from(COVER_BUCKET).upload(path, image.bytes, {
    contentType: image.contentType, cacheControl: "3600", upsert: false,
  });
  // Content-addressed immutable objects make retry/backfill idempotent.
  if (error && !["409", "Duplicate"].includes(String((error as { statusCode?: string }).statusCode)) &&
      !(error as { message?: string }).message?.toLowerCase().includes("already exists"))
    throw new Error("封面存储失败，请确认已应用 010 迁移，或稍后重试。");
  return path;
}
