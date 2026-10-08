import { readBookmarkPreview } from "./bookmark-browser-client.ts";
import { douyinVideoPage } from "./douyin-render-policy.ts";

export async function renderDouyinPreview(value: string): Promise<{ title: string; cover_url: string }> {
  if (!douyinVideoPage(value)) throw new Error("只支持读取抖音视频页面。");
  return readBookmarkPreview(value);
}
