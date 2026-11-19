import type { Photo } from "./photos";

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif";

export interface PreparedPhoto {
  photo: Photo;
  thumbnail: Blob;
  full: Blob;
}

function jpeg(bitmap: ImageBitmap, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("当前浏览器无法处理照片。");
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise<{ blob: Blob; width: number; height: number }>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob?.type === "image/jpeg") resolve({ blob, width: canvas.width, height: canvas.height });
      else reject(new Error("无法生成 JPEG 照片。"));
      canvas.width = canvas.height = 1;
    }, "image/jpeg", quality);
  });
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const heic = /^image\/hei[cf](?:-sequence)?$/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  const supported = /^image\/(jpeg|png|webp|avif)$/i.test(file.type) || /\.(jpe?g|png|webp|avif)$/i.test(file.name);
  if (!heic && !supported) throw new Error("请选择 JPEG、PNG、WebP、AVIF 或 HEIC 照片。");
  const bitmap = heic
    ? await (await import("heic-to/csp")).heicTo({ blob: file, type: "bitmap" })
    : await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const full = await jpeg(bitmap, 2400, 0.9);
    const thumbnail = await jpeg(bitmap, 640, 0.83);
    return { photo: { id: crypto.randomUUID(), width: full.width, height: full.height }, full: full.blob, thumbnail: thumbnail.blob };
  } finally {
    bitmap.close();
  }
}
