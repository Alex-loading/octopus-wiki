import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP } from "node:net";
import { Readable } from "node:stream";
import sharp from "sharp";

export const MAX_COVER_BYTES = 8 * 1024 * 1024;
export type DownloadDependencies = {
  resolve: (hostname: string) => Promise<{ address: string; family: number }[]>;
  request: (url: URL, address: { address: string; family: number }, signal: AbortSignal) => Promise<Response>;
};

const privateNetworks = new BlockList();
for (const [network, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 3]] as const)
  privateNetworks.addSubnet(network, bits, "ipv4");
for (const [network, bits] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const)
  privateNetworks.addSubnet(network, bits, "ipv6");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const fakeDnsRange = new BlockList();
fakeDnsRange.addSubnet("198.18.0.0", 15, "ipv4");

function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? !privateNetworks.check(address, "ipv4")
    : family === 6 && globalV6.check(address, "ipv6") && !privateNetworks.check(address, "ipv6");
}

export async function resolveCoverAddresses(hostname: string, nativeLookup = (name: string) => lookup(name, { all: true }), fetcher = fetch) {
  const addresses = await nativeLookup(hostname);
  if (!addresses.length || !addresses.every(item => item.family === 4 && fakeDnsRange.check(item.address, "ipv4"))) return addresses;
  // Some local VPNs return synthetic 198.18/15 addresses for every public host.
  // Resolve through a fixed HTTPS resolver, then validate and pin the real IP;
  // never allow connecting to the synthetic/private address itself.
  const response = await fetcher(`https://cloudflare-dns.com/dns-query?${new URLSearchParams({ name: hostname, type: "A" })}`, {
    headers: { Accept: "application/dns-json" }, signal: AbortSignal.timeout(5000), redirect: "error",
  });
  if (!response.ok) throw new Error("图片域名解析失败。");
  const data = await response.json() as { Answer?: { type: number; data: string }[] };
  return (data.Answer ?? []).filter(item => item.type === 1 && isIP(item.data) === 4)
    .map(item => ({ address: item.data, family: 4 }));
}

function imageUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("图片地址无效。"); }
  if (value.length > 4096 || /[\s\\]/.test(value) || !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.port || isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    !url.hostname.includes(".") || /\.(localhost|local|internal|test|invalid)$/i.test(url.hostname))
    throw new Error("图片地址必须是不含账号密码的公开 HTTP/HTTPS 地址。");
  return url;
}

// Pin the validated DNS result to the socket. A second DNS lookup by fetch would
// allow DNS rebinding; every redirect instead gets its own validation and socket.
const requestPinned: DownloadDependencies["request"] = (url, address, signal) => new Promise((resolve, reject) => {
  const client = url.protocol === "https:" ? https : http;
  const req = client.get(url, {
    signal, agent: false,
    headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/gif", "Accept-Encoding": "identity", "User-Agent": "OctopusWiki-CoverArchive/1.0" },
    lookup: (_host, options, callback) => {
      if (options.all) (callback as Function)(null, [address]);
      else (callback as Function)(null, address.address, address.family);
    },
  }, res => {
    const headers = new Headers();
    for (const [name, value] of Object.entries(res.headers)) {
      if (Array.isArray(value)) for (const item of value) headers.append(name, item);
      else if (value !== undefined) headers.set(name, value);
    }
    resolve(new Response(Readable.toWeb(res) as ReadableStream<Uint8Array>, { status: res.statusCode ?? 502, headers }));
  });
  req.on("error", reject);
});

export async function downloadCover(value: string, dependencies: DownloadDependencies = {
  resolve: resolveCoverAddresses, request: requestPinned,
}): Promise<{ bytes: Buffer; contentType: string; extension: string }> {
  let url = imageUrl(value);
  const signal = AbortSignal.timeout(15000);
  for (let step = 0; step <= 4; step++) {
    const addresses = await Promise.race([
      dependencies.resolve(url.hostname),
      new Promise<never>((_, reject) => {
        if (signal.aborted) reject(signal.reason);
        else signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    ]);
    if (!addresses.length || addresses.some(item => !isPublicAddress(item.address)))
      throw new Error("图片必须位于公开网络，不能访问内网地址。");
    const response = await dependencies.request(url, addresses[0], signal);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      await response.body?.cancel();
      const location = response.headers.get("location");
      if (!location || step === 4) throw new Error("图片跳转次数过多。");
      url = imageUrl(new URL(location, url).href);
      continue;
    }
    const mime = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!response.ok || !mime || !["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"].includes(mime)) {
      await response.body?.cancel();
      throw new Error(`图片下载失败（HTTP ${response.status}）或不是支持的图片。`);
    }
    if (Number(response.headers.get("content-length")) > MAX_COVER_BYTES) {
      await response.body?.cancel(); throw new Error("封面图片过大，最多 8 MiB。");
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("图片内容为空。");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value: chunk } = await reader.read();
        if (done) break;
        size += chunk.byteLength;
        if (size > MAX_COVER_BYTES) throw new Error("封面图片过大，最多 8 MiB。");
        chunks.push(chunk);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = Buffer.concat(chunks, size);
    try {
      const metadata = await sharp(bytes, { limitInputPixels: 40_000_000 }).metadata();
      const format = metadata.format === "heif" && metadata.compression === "av1" ? "avif" : metadata.format;
      if (!format || !["jpeg", "png", "webp", "gif", "avif"].includes(format) || !metadata.width || !metadata.height)
        throw new Error("invalid format");
      return { bytes, contentType: `image/${format}`, extension: format === "jpeg" ? "jpg" : format };
    } catch { throw new Error("封面不是有效的 JPG、PNG、WebP、GIF 或 AVIF 图片。"); }
  }
  throw new Error("图片下载失败。");
}
