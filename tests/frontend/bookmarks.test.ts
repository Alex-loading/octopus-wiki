import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import {
  extractBookmarkUrls,
  identifyPlatform,
  canonicalBookmarkUrl,
  parseBookmarkUrl,
  captureFromSearch,
  createBookmarklet,
  validateBookmarkDraft,
  emptyBookmark,
} from "../../src/app/content/bookmarks.ts";
import { safeAdminReturnPath } from "../../src/app/auth/adminSession.ts";

test("extracts mobile sharing text, deduplicates links, and classifies real domains", () => {
  assert.deepEqual(
    extractBookmarkUrls(
      "分享一篇好内容 https://xhslink.com/a/abc，复制后打开 https://xhslink.com/a/abc",
    ),
    ["https://xhslink.com/a/abc"],
  );
  assert.deepEqual(
    extractBookmarkUrls(
      "看看 (https://b23.tv/abc)。还有 https://v.douyin.com/AbC/！",
    ),
    ["https://b23.tv/abc", "https://v.douyin.com/AbC/"],
  );
  for (const [url, expected] of [
    ["https://b23.tv/x", "bilibili"],
    ["https://v.douyin.com/x", "douyin"],
    ["https://xhslink.com/x", "xiaohongshu"],
    ["https://www.nowcoder.com/discuss/x", "nowcoder"],
    ["https://bilibili.com.evil.example/x", "other"],
  ])
    assert.equal(identifyPlatform(url), expected);
});
test("preserves signed access parameters, content fragments, and the original URL", () => {
  const url =
    "https://www.xiaohongshu.com/explore/abc?xsec_token=a%2Fb&xsec_source=pc&utM_source=share#part";
  const draft = {
    ...emptyBookmark(),
    collection_id: "10000000-0000-0000-0000-000000000001",
    url,
    title: " 标题 ",
  };
  const payload = validateBookmarkDraft(draft);
  assert.equal(payload.url, url);
  assert.equal(
    payload.canonical_url,
    "https://www.xiaohongshu.com/explore/abc?xsec_token=a%2Fb&xsec_source=pc#part",
  );
  assert.equal(payload.title, "标题");
  assert.notEqual(
    canonicalBookmarkUrl("https://site.example/watch?id=1"),
    canonicalBookmarkUrl("https://site.example/watch?id=2"),
  );
});
test("Android sharing text recognizes current short domains and prefills a usable title", () => {
  const samples = [
    {
      text: "原来真的有这样真挚且幸福的父母爱情 （素材来源于网... https://xhslink.cn/o/8plZFEty9Hb 【小红书】里有答案，快去围观~",
      url: "https://xhslink.cn/o/8plZFEty9Hb",
      platform: "xiaohongshu",
      title: "原来真的有这样真挚且幸福的父母爱情 （素材来源于网...",
    },
    {
      text: "3.84 复制打开抖音，看看【笑出苹果肌（万岁山搞笑没门版）的作品】这哥们儿真男人！# 万岁山武侠城 # 万岁山老嫂子... https://v.douyin.com/U3W4xeBm6Ns/ 10/21 b@N.jP FUY:/ :2pm",
      url: "https://v.douyin.com/U3W4xeBm6Ns/",
      platform: "douyin",
      title: "这哥们儿真男人！# 万岁山武侠城 # 万岁山老嫂子...",
    },
  ];
  for (const sample of samples) {
    assert.deepEqual(extractBookmarkUrls(sample.text), [sample.url]);
    assert.equal(identifyPlatform(sample.url), sample.platform);
    const { draft } = captureFromSearch("?" + new URLSearchParams({ text: sample.text }));
    assert.equal(draft.url, sample.url);
    assert.equal(draft.title, sample.title);
    const saved = validateBookmarkDraft({ ...draft, collection_id: "10000000-0000-0000-0000-000000000001" });
    assert.equal(saved.url, sample.url);
    assert.equal(saved.platform, sample.platform);
  }
  assert.equal(identifyPlatform("https://xhslink.cn.evil.example/o/test"), "other");
});
test("pasted Markdown links do not absorb the surrounding link syntax", () => {
  const url = "https://xhslink.cn/o/8plZFEty9Hb";
  assert.deepEqual(extractBookmarkUrls(`分享 [${url}](${url}) 【小红书】`), [url]);
  assert.equal(captureFromSearch("?" + new URLSearchParams({ title: `好内容 ${url}` })).draft.url, url);
  assert.equal(captureFromSearch("?text=" + encodeURIComponent(url)).draft.title, "");
});
test("rejects active schemes, malformed URLs, credentials, oversized input and missing categories", () => {
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///tmp/file",
    "https://user:secret@site.example",
    "https://bad\\host/path",
    "https://exa mple.com",
    "//example.com",
    "https://x.example/" + "a".repeat(4096),
  ])
    assert.throws(() => parseBookmarkUrl(value));
  assert.throws(
    () =>
      validateBookmarkDraft({
        ...emptyBookmark(),
        url: "https://example.com",
        title: "hello",
      }),
    /收藏箱/,
  );
});
test("editing a joined database row writes only editable fields", () => {
  const row = {
    ...emptyBookmark(),
    id: "existing",
    created_at: "old",
    bookmark_collections: { is_public: true },
    collection_id: "10000000-0000-0000-0000-000000000001",
    title: "编辑",
    url: "https://example.com",
  };
  const payload = validateBookmarkDraft(row);
  assert.deepEqual(
    Object.keys(payload).sort(),
    [
      "canonical_url",
      "collection_id",
      "cover_url",
      "is_public",
      "note",
      "platform",
      "title",
      "url",
    ].sort(),
  );
});
test("shared drafts survive login return paths and multiple URLs require a choice", () => {
  const text = "收藏 https://xhslink.com/a/123";
  const path =
    "/collect?" +
    new URLSearchParams({
      text,
      title: "想再看一次",
      cover: "javascript:alert(1)",
    });
  assert.equal(safeAdminReturnPath(path), path);
  const { draft } = captureFromSearch(path.slice(path.indexOf("?")));
  assert.equal(draft.url, "https://xhslink.com/a/123");
  assert.equal(draft.title, "想再看一次");
  assert.equal(draft.cover_url, "");
  assert.equal(
    captureFromSearch(
      "?text=" + encodeURIComponent("https://b23.tv/1 https://b23.tv/2"),
    ).draft.url,
    "",
  );
  assert.equal(safeAdminReturnPath("/collect/../../evil"), "/admin/articles");
  assert.equal(
    safeAdminReturnPath("//evil.example/collect"),
    "/admin/articles",
  );
});
test("bookmarklet passes current URL and metadata without leaking session state", () => {
  let opened: { href: string; target: string } | undefined;
  vm.runInNewContext(
    createBookmarklet("https://wiki.example").slice("javascript:".length),
    {
      URL,
      location: { href: "https://www.bilibili.com/video/BV123?foo=bar#part" },
      document: {
        title: "测试标题",
        querySelector: () => ({ content: "/cover.jpg" }),
      },
      window: {
        open: (href: string, target: string) => {
          opened = { href, target };
        },
      },
    },
  );
  const destination = new URL(opened!.href);
  assert.equal(destination.origin, "https://wiki.example");
  assert.equal(destination.pathname, "/collect");
  assert.equal(
    destination.searchParams.get("url"),
    "https://www.bilibili.com/video/BV123?foo=bar#part",
  );
  assert.equal(
    destination.searchParams.get("cover"),
    "https://www.bilibili.com/cover.jpg",
  );
  assert.equal(opened!.target, "octopus-collector");
});
