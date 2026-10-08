import assert from "node:assert/strict";
import test from "node:test";
import {
  allowedXiaohongshuResource, BookmarkReaderError, noteId,
  requiresXiaohongshuLogin, validateXiaohongshuPreview, xiaohongshuUrl,
} from "../../services/bookmark-reader/policy.ts";

test("小红书链接保留参数，并拒绝无效协议、账号和域名", () => {
  const source = "https://xhslink.cn/o/isOHHGiso1";
  assert.equal(xiaohongshuUrl(source).href, source);
  const destination = new URL("https://www.xiaohongshu.com/discovery/item/6a33dbfc0000000015024b49");
  destination.searchParams.set("xsec_source", "app_share");
  assert.equal(xiaohongshuUrl(destination.href).href, destination.href);
  assert.equal(noteId(destination.href), "6a33dbfc0000000015024b49");
  assert.equal(noteId(source), null);
  for (const value of [
    "", "invalid", "https://www.xiaohongshu.com/ ", "http://www.xiaohongshu.com/",
    "https://www.xiaohongshu.com.evil.example/", "https://user@www.xiaohongshu.com/",
    "https://www.xiaohongshu.com:444/", "https://127.0.0.1/",
  ]) assert.throws(() => xiaohongshuUrl(value), error =>
    error instanceof BookmarkReaderError && error.code === "INVALID_URL" && error.status === 400);
});

test("登录路径和页面网络域名经过校验", () => {
  assert.equal(requiresXiaohongshuLogin("https://www.xiaohongshu.com/login?redirectPath=%2Fexplore"), true);
  assert.equal(requiresXiaohongshuLogin("https://www.xiaohongshu.com/explore/6a33dbfc0000000015024b49"), false);
  assert.equal(allowedXiaohongshuResource("https://sns-webpic-qc.xhscdn.com/"), true);
  assert.equal(allowedXiaohongshuResource("https://www.xiaohongshu.com/"), true);
  for (const value of [
    "https://127.0.0.1/", "https://www.xiaohongshu.com.evil.example/",
    "https://user@sns-webpic-qc.xhscdn.com/", "http://sns-webpic-qc.xhscdn.com/", "invalid",
  ]) assert.equal(allowedXiaohongshuResource(value), false, value);
});

test("默认标题、默认图片和缺失内容明确返回元数据错误", () => {
  for (const value of [
    null, {}, { title: "小红书" }, { title: "小红书 - 你的生活兴趣社区" },
    { title: "我在浙大社会学系毕业典礼上的发言🎙️", cover_url: "" },
    { title: "我在浙大社会学系毕业典礼上的发言🎙️", cover_url: "invalid" },
    { title: "我在浙大社会学系毕业典礼上的发言🎙️", cover_url: "https://picasso-static.xiaohongshu.com/fe-platform/" },
  ]) assert.throws(() => validateXiaohongshuPreview(value), error =>
    error instanceof BookmarkReaderError && error.code === "METADATA_MISSING");
});
