import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { POST as adminPreview } from "../../api/bookmark-preview.ts";
import { POST as collector } from "../../api/collector.ts";

test("平台登录操作要求管理员授权", async () => {
  for (const action of ["login-start", "login-check", "login-cancel"]) {
    const response = await adminPreview(new Request("https://octopus-wiki.vercel.app/api/bookmark-preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, url: "https://xhslink.cn/o/isOHHGiso1", requestId: randomUUID(), sessionId: randomUUID() }),
    }));
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal((await response.json()).success, false);
  }
});

test("设备收藏禁止其他网站发起平台登录操作", async () => {
  for (const action of ["login-start", "login-check", "login-cancel"]) {
    const response = await collector(new Request("https://octopus-wiki.vercel.app/api/collector", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "https://www.xiaohongshu.com", "Sec-Fetch-Site": "cross-site" },
      body: JSON.stringify({ action, url: "https://xhslink.cn/o/isOHHGiso1", requestId: randomUUID(), sessionId: randomUUID() }),
    }));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).success, false);
  }
});
