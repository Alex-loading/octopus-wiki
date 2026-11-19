export const PHOTO_CAPTION_LIMIT = 2000;
export const PHOTO_PAGE_SIZE = 24;

export type Photo = { id: string; width: number; height: number };

export interface PhotoEntry {
  id: string;
  caption: string;
  occurred_at: string;
  photos: Photo[];
  is_public: boolean;
  revision: number;
  updated_at: string;
}

const timeFormat = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" });

export function formatPhotoTime(value: string) {
  return timeFormat.format(new Date(value));
}

export function photoLocalTime(value = new Date()) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function photoEntryValues(caption: string, time: string, photos: Photo[], isPublic: boolean) {
  const occurredAt = new Date(time);
  if (!Number.isFinite(occurredAt.getTime())) throw new Error("请输入有效的记录时间。");
  const text = caption.trim();
  if (text.length > PHOTO_CAPTION_LIMIT) throw new Error(`配文最多可以输入 ${PHOTO_CAPTION_LIMIT} 个字符。`);
  if (!photos.length) throw new Error("请至少添加一张照片。");
  return { caption: text, occurred_at: occurredAt.toISOString(), photos, is_public: isPublic };
}

export function photoPaths(entryId: string, photoId: string) {
  const folder = `${entryId}/${photoId}`;
  return { thumbnail: `${folder}/thumbnail.jpg`, full: `${folder}/full.jpg` };
}
