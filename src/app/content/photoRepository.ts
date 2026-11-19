import { StorageApiError } from "@supabase/supabase-js";
import { getSupabaseClient } from "./repository";
import { PHOTO_PAGE_SIZE, photoPaths, type PhotoEntry, type photoEntryValues } from "./photos";
import type { PreparedPhoto } from "./preparePhoto";

const BUCKET = "photo-entries";
const ENTRY_FIELDS = "id,caption,occurred_at,photos,is_public,revision,updated_at";

function client() {
  const db = getSupabaseClient();
  if (!db) throw new Error("照片服务尚未配置。");
  return db;
}

export async function listPhotoEntries(admin: boolean, after?: PhotoEntry, signal?: AbortSignal) {
  const order = admin ? "updated_at" : "occurred_at";
  let query = client().from("photo_entries").select(ENTRY_FIELDS, after ? undefined : { count: "exact" })
    .order(order, { ascending: false }).order("id", { ascending: false }).limit(PHOTO_PAGE_SIZE + 1);
  if (!admin) query = query.eq("is_public", true);
  if (after) query = query.or(`${order}.lt.${after[order]},and(${order}.eq.${after[order]},id.lt.${after.id})`);
  if (signal) query = query.abortSignal(signal);
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return { entries: (data as PhotoEntry[]).slice(0, PHOTO_PAGE_SIZE), hasMore: data.length > PHOTO_PAGE_SIZE, total: count };
}

export async function savePhotoEntry(id: string, values: ReturnType<typeof photoEntryValues>, revision?: number) {
  const table = client().from("photo_entries");
  const query = revision === undefined ? table.insert({ ...values, id })
    : table.update(values).eq("id", id).eq("revision", revision);
  const { data, error } = await query.select(ENTRY_FIELDS).maybeSingle();
  if (error) throw new Error(error.code === "23505" ? "这条记录已保存，请重新打开后编辑。" : error.message);
  if (!data) throw new Error("记录已在其他页面更新，请重新打开后编辑。");
  return data as PhotoEntry;
}

export async function uploadPhoto(entryId: string, image: PreparedPhoto) {
  const bucket = client().storage.from(BUCKET);
  const paths = photoPaths(entryId, image.photo.id);
  for (const variant of ["thumbnail", "full"] as const) {
    const { error } = await bucket.upload(paths[variant], image[variant], { contentType: "image/jpeg", cacheControl: "0" });
    // 同一张待保存照片使用固定路径，重试时保留已成功上传的文件。
    if (error && !(error instanceof StorageApiError && ["409", "Duplicate", "ResourceAlreadyExists"].includes(error.statusCode ?? ""))) {
      throw error;
    }
  }
}

export async function downloadPhoto(path: string, signal: AbortSignal) {
  const { data, error } = await client().storage.from(BUCKET).download(path, {}, { signal, cache: "no-store" });
  if (error) throw error;
  return data;
}
