const VIDEO_HOSTS = new Set(["douyin.com", "www.douyin.com", "www.iesdouyin.com"]);
const RESOURCE_DOMAINS = [
  "douyin.com", "iesdouyin.com", "douyinstatic.com", "bytegoofy.com",
  "bytetos.com", "bytescm.com", "yhgfb-cn-static.com", "applogcdn.com",
  "ibytedapm.com", "byteimg.com", "zijieapi.com",
];
function publicHttps(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.port && !url.username && !url.password ? url : null;
  } catch { return null; }
}
export function douyinVideoPage(value: string): string | null {
  const url = publicHttps(value);
  if (!url || !VIDEO_HOSTS.has(url.hostname)) return null;
  const id = url.pathname.match(/^\/(?:share\/)?video\/(\d{10,25})\/?$/)?.[1];
  return id ? `https://www.douyin.com/video/${id}` : null;
}
export function allowedDouyinResource(value: string, type: string): boolean {
  if (!["document", "script", "stylesheet", "xhr", "fetch", "other"].includes(type)) return false;
  const url = publicHttps(value);
  return !!url && RESOURCE_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
}
