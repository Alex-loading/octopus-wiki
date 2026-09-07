import assert from "node:assert/strict";
import test from "node:test";
import { douyinVideoPage, allowedDouyinResource } from "../../api/_lib/douyin-render-policy.ts";

test("rendering only accepts canonical public Douyin video destinations", () => {
  assert.equal(douyinVideoPage("https://www.iesdouyin.com/share/video/7681983811227372425/?share_sign=abc"), "https://www.douyin.com/video/7681983811227372425");
  assert.equal(douyinVideoPage("https://www.douyin.com/video/7681983811227372425?previous_page=web_code_link"), "https://www.douyin.com/video/7681983811227372425");
  for (const value of ["https://evil.example/video/7681983811227372425", "https://www.douyin.com.evil.example/video/7681983811227372425", "https://www.douyin.com@evil.example/video/7681983811227372425", "https://user@www.douyin.com/video/7681983811227372425", "http://www.douyin.com/video/7681983811227372425", "https://www.douyin.com:8080/video/7681983811227372425", "https://www.douyin.com/user/123", "https://www.douyin.com/video/../../api/123", "not a URL"])
    assert.equal(douyinVideoPage(value), null, value);
});

test("the rendered page can load platform scripts and APIs but cannot request arbitrary hosts or media", () => {
  assert.equal(allowedDouyinResource("https://lf-douyin-pc-web.douyinstatic.com/a.js", "script"), true);
  assert.equal(allowedDouyinResource("https://www.douyin.com/aweme/v1/web/aweme/detail/", "fetch"), true);
  for (const value of ["http://www.douyin.com/api", "https://www.douyin.com.evil.example/api", "https://evil.example/api", "https://127.0.0.1/api", "https://169.254.169.254/latest/meta-data/", "https://localhost/api", "file:///etc/passwd", "https://user@www.douyin.com/api", "https://www.douyin.com:8443/api"])
    assert.equal(allowedDouyinResource(value, "fetch"), false, value);
  for (const kind of ["media", "image", "font", "websocket"])
    assert.equal(allowedDouyinResource("https://www.douyin.com/a", kind), false);
});
