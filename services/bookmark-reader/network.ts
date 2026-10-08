import type { Page, HTTPResponse } from "puppeteer-core";
import type { BookmarkMetadata } from "../../src/app/content/bookmarkPreview.ts";
import { BookmarkReaderError } from "./policy.ts";

// 读取页面已经发起的视频详情响应，按视频 ID 保存可验证的内容信息。
export function observeDouyinMetadata(page: Page) {
  const entries = new Map<string, BookmarkMetadata>();
  let failure: unknown;
  const inspect = async (response: HTTPResponse) => {
    const url = new URL(response.url());
    if (url.hostname !== "www.douyin.com" || url.pathname !== "/aweme/v1/web/aweme/detail/" ||
        response.request().method() !== "GET" || !response.ok() ||
        !response.headers()["content-type"]?.includes("application/json")) return;
    if (Number(response.headers()["content-length"]) > 2 * 1024 * 1024)
      throw new BookmarkReaderError("METADATA_MISSING", "视频详情数据过大。", 422, "douyin");
    const bytes = await response.content();
    if (bytes.length > 2 * 1024 * 1024)
      throw new BookmarkReaderError("METADATA_MISSING", "视频详情数据过大。", 422, "douyin");
    const data = JSON.parse(new TextDecoder().decode(bytes)) as {
      aweme_detail?: { aweme_id?: string; desc?: string; video?: { cover?: { url_list?: string[] } } };
    };
    const detail = data.aweme_detail;
    if (detail?.aweme_id && detail.aweme_id === url.searchParams.get("aweme_id") &&
        typeof detail.desc === "string" && typeof detail.video?.cover?.url_list?.[0] === "string")
      entries.set(detail.aweme_id, { title: detail.desc.trim().slice(0, 300), cover_url: detail.video.cover.url_list[0] });
  };
  const listener = (response: HTTPResponse) => {
    void inspect(response).catch(error => { if (!page.isClosed()) failure = error; });
  };
  page.on("response", listener);
  return {
    read(id: string | null) {
      if (failure) throw failure;
      return id ? entries.get(id) : undefined;
    },
    dispose() { page.off("response", listener); },
  };
}
