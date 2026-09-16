import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { downloadCover, resolveCoverAddresses, type DownloadDependencies } from "../../api/_lib/cover-download.ts";
import { prepareBookmarkCover } from "../../api/_lib/bookmark-cover.ts";

const image = () => sharp({ create: { width: 4, height: 4, channels: 3, background: "red" } }).png().toBuffer();
const resolve = async () => [{ address: "93.184.215.14", family: 4 }];

test("VPN synthetic DNS resolves to a real pinned public address without allowing private connections", async () => {
  const request: DownloadDependencies["request"] = async (_url, address) => {
    assert.equal(address.address, "93.184.215.14");
    return new Response(new Uint8Array(await image()), { headers: { "Content-Type": "image/png" } });
  };
  const native = async () => [{ address: "198.18.0.7", family: 4 }];
  const doh = async () => Response.json({ Answer: [{ type: 1, data: "93.184.215.14" }] });
  await downloadCover("https://cdn.example/a", { resolve: host => resolveCoverAddresses(host, native, doh), request });
  await assert.rejects(downloadCover("https://cdn.example/a", {
    resolve: host => resolveCoverAddresses(host, native, async () => Response.json({ Answer: [{ type: 1, data: "127.0.0.1" }] })), request,
  }), /公开网络/);
});

test("downloads covers from any public platform and checks the real image format", async () => {
  const bytes = await image();
  const result = await downloadCover("https://independent-blog.example/cover?sig=a%2Fb", {
    resolve,
    request: async (url, address, signal) => {
      assert.equal(url.search, "?sig=a%2Fb");
      assert.equal(address.address, "93.184.215.14");
      assert.ok(signal);
      return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/png" } });
    },
  });
  assert.deepEqual(result.bytes, bytes);
  assert.equal(result.extension, "png");
});

test("rejects private DNS, IP literals, credentials and redirects into internal networks before connecting", async () => {
  let calls = 0;
  const request: DownloadDependencies["request"] = async () => {
    calls++;
    return new Response(null, { status: 302, headers: { location: "http://127.0.0.1/secret" } });
  };
  for (const address of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "100.64.0.1", "192.168.1.1", "::1", "::ffff:127.0.0.1", "fc00::1", "2002:7f00:1::"])
    await assert.rejects(downloadCover("https://image.example/x", { resolve: async () => [{ address, family: address.includes(":") ? 6 : 4 }], request }), /公开网络/);
  for (const url of ["http://127.1/x", "https://user:pass@image.example/x", "file:///etc/passwd", "http://image.example:8080/x"])
    await assert.rejects(downloadCover(url, { resolve, request }), /图片地址/);
  assert.equal(calls, 0);
  await assert.rejects(downloadCover("https://image.example/x", { resolve, request }), /图片地址/);
  assert.equal(calls, 1);
});

test("rejects HTML, SVG, fake images and oversized chunked responses", async () => {
  for (const response of [
    new Response("<html>expired</html>", { headers: { "Content-Type": "text/html" } }),
    new Response("<svg/>", { headers: { "Content-Type": "image/svg+xml" } }),
    new Response("not an image", { headers: { "Content-Type": "image/png" } }),
    new Response(new Uint8Array(8 * 1024 * 1024 + 1), { headers: { "Content-Type": "image/png" } }),
  ]) await assert.rejects(downloadCover("https://cdn.example/a", { resolve, request: async () => response }), /图片|过大/);
});

test("saving retains source links but persists a storage path for every platform", async () => {
  for (const platform of ["xiaohongshu", "douyin", "bilibili", "nowcoder", "other"]) {
    const payload = { cover_url: `https://${platform}.example/cover`, url: "https://page.example/post", platform };
    const output = await prepareBookmarkCover(payload, null, async (url, page) => {
      assert.equal(url, payload.cover_url); assert.equal(page, payload.url); return "abc.png";
    });
    assert.equal(output.cover_url, payload.cover_url);
    assert.equal(output.cover_storage_path, "abc.png");
  }
});

test("editing keeps archived covers after source expiry, clearing removes the path, and failures never silently save external links", async () => {
  const existing = { cover_url: "https://expired.example/cover", cover_storage_path: "old.png" };
  const archive = async () => { throw new Error("图片转存失败"); };
  assert.equal((await prepareBookmarkCover({ ...existing, url: "https://page.example" }, existing, archive)).cover_storage_path, "old.png");
  assert.equal((await prepareBookmarkCover({ cover_url: "", url: "https://page.example" }, existing, archive)).cover_storage_path, "");
  await assert.rejects(prepareBookmarkCover({ cover_url: "https://new.example/cover", url: "https://page.example" }, existing, archive), /转存失败/);
});
