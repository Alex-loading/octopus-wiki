import type { ReaderPlatform } from "./platforms.ts";

export type PageSnapshot = {
  title: string;
  cover_url: string;
  loginVisible: boolean;
  verificationVisible: boolean;
  hasContent: boolean;
};

// 此函数由 Puppeteer 在页面中执行，只使用传入配置和浏览器 DOM。
export function inspectPlatformPage(config: Pick<ReaderPlatform, "id" | "loginSelectors" | "verificationSelectors">): PageSnapshot {
  const visible = (selector: string) => Array.from(document.querySelectorAll(selector)).some(element => {
    const style = getComputedStyle(element);
    const bounds = element.getBoundingClientRect();
    return style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) !== 0 &&
      bounds.width > 0 && bounds.height > 0;
  });
  const meta = (...names: string[]) => names.map(name => {
    const nodes = document.querySelectorAll<HTMLMetaElement>(`meta[property="${name}"],meta[name="${name}"]`);
    return Array.from(nodes).map(node => node.content).filter(Boolean).at(-1);
  }).find(Boolean) || "";
  let title = meta("og:title", "twitter:title", "lark:url:video_title") ||
    document.querySelector("#activity-name, h1.video-title, h1.article-title")?.textContent || document.title;
  let cover = meta("og:image", "twitter:image", "lark:url:video_cover_image_url");
  if (config.id === "douyin") {
    const id = location.pathname.match(/^\/(?:share\/)?(?:video|note)\/(\d{10,25})\/?$/)?.[1];
    if (id) title = document.querySelector(`[data-e2e="detail-video-info"][data-e2e-aweme-id="${id}"] h1`)?.textContent || title;
  }
  if (config.id === "xiaohongshu") {
    const id = location.pathname.match(/^\/(?:explore|discovery\/item)\/([a-f\d]{24})\/?$/i)?.[1];
    const state = (window as typeof window & { __INITIAL_STATE__?: {
      note?: { noteDetailMap?: Record<string, { note?: { title?: string; imageList?: { urlDefault?: string }[] } }> };
    } }).__INITIAL_STATE__;
    const note = id ? state?.note?.noteDetailMap?.[id]?.note : undefined;
    title = note?.title || "";
    cover = note?.imageList?.[0]?.urlDefault || "";
  }
  return {
    title: title.replace(/\s+/gu, " ").trim().slice(0, 300),
    cover_url: cover && URL.canParse(cover, location.href) ? new URL(cover, location.href).href : "",
    loginVisible: [...config.loginSelectors, 'form input[type="password"]', '[role="dialog"] input[type="password"]'].some(visible),
    verificationVisible: config.verificationSelectors.some(visible),
    hasContent: Boolean(meta("og:title", "twitter:title", "lark:url:video_title") && cover) ||
      Boolean(document.querySelector("article, #js_content, h1.video-title, h1.article-title, [data-e2e='detail-video-info']")) ||
      (config.id === "xiaohongshu" && Boolean(title && cover)),
  };
}
