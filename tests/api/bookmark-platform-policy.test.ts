import assert from "node:assert/strict";
import test from "node:test";
import { READER_PLATFORMS } from "../../services/bookmark-reader/platforms.ts";
import {
  allowedPlatformPage, allowedPlatformResource, contentIdentity, isDefaultTitle,
  platformForUrl, readerUrl, requiresPlatformLogin,
} from "../../services/bookmark-reader/policy.ts";

test("已支持的平台共用链接验证与登录识别", () => {
  assert.equal(READER_PLATFORMS.length, 5);
  for (const platform of READER_PLATFORMS) {
    for (const host of platform.pageHosts) {
      const url = `https://${host}/`;
      assert.equal(platformForUrl(readerUrl(url))?.id, platform.id);
      assert.equal(allowedPlatformPage(url, platform), true);
      assert.equal(requiresPlatformLogin(`${url}login`, platform), true);
      assert.equal(requiresPlatformLogin(`${url}article/login-guide`, platform), false);
      assert.equal(allowedPlatformResource(url, platform), true);
      assert.equal(allowedPlatformPage(`${url.replace(host, `${host}.example`)}`, platform), false);
      assert.throws(() => readerUrl(`https://user@${host}/`));
      assert.throws(() => readerUrl(`https://${host}:444/`));
    }
    for (const host of platform.authHosts)
      assert.equal(requiresPlatformLogin(`https://${host}/`, platform), true);
    assert.equal(allowedPlatformResource("https://127.0.0.1/", platform), false);
    assert.equal(allowedPlatformPage("https://www.example.com/login", platform), false);
    assert.equal(isDefaultTitle("账号登录", platform), true);
    assert.equal(isDefaultTitle("如何实现账号登录", platform), false);
  }
});

test("短链接跳转后按内容标识校验原页面，分享参数保持原样", () => {
  const xhs = READER_PLATFORMS.find(item => item.id === "xiaohongshu")!;
  const douyin = READER_PLATFORMS.find(item => item.id === "douyin")!;
  assert.equal(contentIdentity("https://xhslink.cn/o/isOHHGiso1", xhs), null);
  assert.equal(contentIdentity("https://www.xiaohongshu.com/explore/6a33dbfc0000000015024b49", xhs), "6a33dbfc0000000015024b49");
  assert.equal(contentIdentity("https://www.iesdouyin.com/share/video/7688294678848581075/", douyin), "7688294678848581075");
  assert.equal(contentIdentity("https://www.douyin.com/video/7688294678848581075", douyin), "7688294678848581075");
  assert.equal(contentIdentity("https://www.douyin.com/", douyin), null);
  const source = "https://mp.weixin.qq.com/s?__biz=Mzg&mid=123&idx=1&sn=abc";
  assert.equal(readerUrl(source).href, source);
  assert.equal(contentIdentity(source, platformForUrl(source)!), "Mzg:123:1");
});
