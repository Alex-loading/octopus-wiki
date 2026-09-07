import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedPreviewUrl,
  fetchBookmarkPreview,
  parsePreviewHtml,
} from "../../api/_lib/bookmark-preview.ts";
import { createBookmarkPreviewHandler } from "../../api/bookmark-preview.ts";

test("metadata parses reversed attributes, entities and relative images", () => {
  const result = parsePreviewHtml(
    `<title>fallback</title><meta content='标题 &amp; &#x4e2d;&#25991;' property="og:title"><meta property="og:image" content="/image.jpg?a=1&amp;b=2">`,
    "https://www.bilibili.com/video/123",
  );
  assert.deepEqual(result, {
    title: "标题 & 中文",
    cover_url: "https://www.bilibili.com/image.jpg?a=1&b=2",
  });
  assert.equal(
    parsePreviewHtml(
      '<meta property="og:image" content="javascript:alert(1)">',
      "https://www.bilibili.com",
    ).cover_url,
    "",
  );
});
test("reads Douyin lark video metadata and preserves the signed cover URL", () => {
  const cover = "https://p3-pc-sign.douyinpic.com/image-cut-tos-priv/a3b131e6390efd84edecaf8a65ecb90c~tplv-dy-resize-origshort-autoq-75:330.jpeg?biz_tag=pcweb_cover&from=327834062&lk3s=138a59ce&s=PackSourceEnum_AWEME_DETAIL&sc=cover&se=false&x-expires=2104146000&x-signature=GaVQ9afspV6VJLEtosb2YqJsYgI%3D";
  const title = "这哥们儿真男人！#万岁山武侠城 #万岁山老嫂子 #老嫂子 #老嫂子欢乐大舞台 - 抖音";
  const html = `<title>抖音</title>
    <meta name="lark:url:video_title" content="${title}" data-rh="true">
    <meta name="lark:url:video_cover_image_url" content="${cover.replaceAll("&", "&amp;")}" data-rh="true">`;
  assert.deepEqual(parsePreviewHtml(html, "https://www.douyin.com/video/7681983811227372425"), { title, cover_url: cover });
  assert.equal(parsePreviewHtml('<meta name="lark:url:video_cover_image_url" content="javascript:alert(1)">', "https://www.douyin.com").cover_url, "");
});
test("Xiaohongshu sharing HTML uses the note cover over its logo and upgrades its CDN URL to HTTPS", () => {
  const image = "sns-webpic-qc.xhscdn.com/202609072215/e853518b158968cc47b951b8dfec5175/1040g008324mkk0847a605pufpkuj9cq0d6048d8!nd_dft_wlteh_jpg_3";
  const html = `<meta property="og:image" content="//picasso-static.xiaohongshu.com/logo.png">
    <meta property="og:title" content="原来真的有这样真挚且幸福的父母爱情 - 小红书">
    <meta property="og:image" content="http://${image}">
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests">`;
  assert.deepEqual(parsePreviewHtml(html, "https://www.xiaohongshu.com/discovery/item/6a9a92dc000000000d0246f6"), {
    title: "原来真的有这样真挚且幸福的父母爱情 - 小红书",
    cover_url: `https://${image}`,
  });
  for (const image of ["http://unverified.example/cover.jpg", "http://xhscdn.com.evil.example/a", "http://sns-webpic-qc.xhscdn.com:8080/a", "http://user@sns-webpic-qc.xhscdn.com/a"])
    assert.equal(parsePreviewHtml(`<meta property="og:image" content="${image}">`, "https://www.xiaohongshu.com").cover_url, "");
});
test("preview allows only known HTTPS hosts and validates every redirect before fetching it", async () => {
  for (const url of [
    "http://www.bilibili.com",
    "https://www.bilibili.com.evil.example",
    "https://127.0.0.1",
    "https://user@www.bilibili.com",
    "https://www.bilibili.com:444",
    "https://arbitrary.bilibili.com",
  ])
    assert.throws(() => allowedPreviewUrl(url));
  let calls = 0;
  await assert.rejects(
    fetchBookmarkPreview("https://b23.tv/abc", (async () => {
      calls++;
      return new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/private" },
      });
    }) as typeof fetch),
    /不支持自动读取/,
  );
  assert.equal(calls, 1);
});
test("follows approved short links and bounds content and redirect loops", async () => {
  const requests: string[] = [];
  const result = await fetchBookmarkPreview("https://b23.tv/abc", (async (
    url,
    options,
  ) => {
    requests.push(String(url));
    assert.equal(options?.redirect, "manual");
    assert.ok(options?.signal);
    return requests.length === 1
      ? new Response(null, {
          status: 302,
          headers: { location: "https://www.bilibili.com/video/BVabc" },
        })
      : new Response("<title>一个视频</title>", {
          headers: { "content-type": "text/html" },
        });
  }) as typeof fetch);
  assert.equal(result.title, "一个视频");
  assert.equal(requests.length, 2);
  await assert.rejects(
    fetchBookmarkPreview(
      "https://www.bilibili.com",
      (async () =>
        new Response("x".repeat(512 * 1024 + 1), {
          headers: { "content-type": "text/html" },
        })) as typeof fetch,
    ),
    /过大/,
  );
  await assert.rejects(
    fetchBookmarkPreview(
      "https://b23.tv/abc",
      (async () =>
        new Response(null, {
          status: 302,
          headers: { location: "/abc" },
        })) as typeof fetch,
    ),
    /跳转过多/,
  );
});
test("follows xhslink.cn while preserving signed destination parameters and redirect restrictions", async () => {
  const destination = "https://www.xiaohongshu.com/discovery/item/abc?xsec_token=a%2Fb&xsec_source=app_share";
  const visited: string[] = [];
  const preview = await fetchBookmarkPreview("https://xhslink.cn/o/8plZFEty9Hb", (async (url) => {
    visited.push(String(url));
    return visited.length === 1
      ? new Response(null, { status: 302, headers: { location: destination } })
      : new Response('<title>父母爱情 - 小红书</title><meta property="og:image" content="https://sns-img.example/cover.jpg">', { headers: { "content-type": "text/html" } });
  }) as typeof fetch);
  assert.deepEqual(visited, ["https://xhslink.cn/o/8plZFEty9Hb", destination]);
  assert.equal(preview.title, "父母爱情 - 小红书");
  assert.equal(preview.cover_url, "https://sns-img.example/cover.jpg");
  assert.throws(() => allowedPreviewUrl("https://xhslink.cn.evil.example/o/test"));
  assert.throws(() => allowedPreviewUrl("https://arbitrary.xhslink.cn/o/test"));
});
test("Douyin short links without page metadata report an optional preview failure", async () => {
  const visited: string[] = [];
  await assert.rejects(fetchBookmarkPreview("https://v.douyin.com/U3W4xeBm6Ns/", (async (url) => {
    visited.push(String(url));
    const next = ["https://www.iesdouyin.com/share/video/7681983811227372425/", "https://www.douyin.com/video/7681983811227372425"][visited.length - 1];
    return next
      ? new Response(null, { status: 302, headers: { location: next } })
      : new Response('<html><script src="/page.js"></script></html>', { headers: { "content-type": "text/html" } });
  }) as typeof fetch, async () => { throw new Error("抖音页面未返回视频信息，请稍后重试。"); }), /未返回视频信息/);
  assert.equal(visited.length, 3);
});
test("a Douyin share link renders the resolved video when the downloaded HTML has no metadata", async () => {
  const rendered: string[] = [];
  const destination = "https://www.douyin.com/video/7681983811227372425?previous_page=web_code_link";
  const expected = { title: "这哥们儿真男人！#万岁山武侠城 - 抖音", cover_url: "https://p3-pc-sign.douyinpic.com/cover.jpeg?x-signature=abc%3D" };
  const result = await fetchBookmarkPreview("https://v.douyin.com/728lgXkTLvg/", (async (url) =>
    String(url).includes("v.douyin.com")
      ? new Response(null, { status: 302, headers: { location: destination } })
      : new Response('<meta charset="UTF-8"><script src="/page.js"></script>', { headers: { "content-type": "text/html" } })
  ) as typeof fetch, async (url) => { rendered.push(url); return expected; });
  assert.deepEqual(rendered, [destination]);
  assert.deepEqual(result, expected);
});
test("browser rendering is skipped for complete Douyin metadata and non-Douyin pages", async () => {
  const render = async () => { assert.fail("unnecessary browser launch"); };
  const fetcher = async () => new Response('<meta property="og:title" content="标题"><meta property="og:image" content="https://cdn.example/cover.jpg">', { headers: { "content-type": "text/html" } });
  await fetchBookmarkPreview("https://www.douyin.com/video/7681983811227372425", fetcher, render);
  await fetchBookmarkPreview("https://www.xiaohongshu.com/explore/123", async () => new Response('<title>笔记</title>', { headers: { "content-type": "text/html" } }), render);
});
test("preview authenticates before any fetch, keeps replies private and gracefully fails", async () => {
  let calls = 0;
  const handler = createBookmarkPreviewHandler({
    isAdmin: async (token) => token === "admin",
    preview: async () => {
      calls++;
      throw new Error("请手动填写");
    },
  });
  const request = (token = "") =>
    new Request("https://wiki.example/api/bookmark-preview", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url: "https://b23.tv/abc" }),
    });
  assert.equal((await handler(request())).status, 403);
  assert.equal((await handler(request("reader"))).status, 403);
  assert.equal(calls, 0);
  const result = await handler(request("admin"));
  assert.equal(result.status, 422);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.equal((await result.json()).message, "请手动填写");
  assert.equal(calls, 1);
});
