import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BOOKMARK_PREVIEW_TIMEOUTS } from "../../src/app/content/bookmarkPreviewTimeouts.ts";

const deployment = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8"));
const maximumWorkTime = BOOKMARK_PREVIEW_TIMEOUTS.http +
  BOOKMARK_PREVIEW_TIMEOUTS.browserLaunch +
  BOOKMARK_PREVIEW_TIMEOUTS.browserRender +
  BOOKMARK_PREVIEW_TIMEOUTS.browserClose;

for (const route of ["api/bookmark-preview.ts", "api/collector.ts"]) {
  test(`${route} 为预览读取、鉴权和响应保留完整等待时间`, () => {
    const functionTimeout = deployment.functions[route].maxDuration * 1000;
    assert.ok(functionTimeout >= maximumWorkTime + 8000, "服务端需要预留鉴权、浏览器准备和响应时间。");
    assert.ok(BOOKMARK_PREVIEW_TIMEOUTS.request >= functionTimeout + 10000, "前端需要等待服务端完成并返回响应。");
  });
}
