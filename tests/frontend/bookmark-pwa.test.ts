import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { captureFromSearch } from "../../src/app/content/bookmarks.ts";

test("installed share target delivers URL and text into the collector without a write", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("../../public/manifest.webmanifest", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.share_target.action, "/collect");
  assert.equal(manifest.share_target.method, "GET");
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({
    text: "分享 https://b23.tv/abc",
    title: "一个视频",
  }))
    query.set(manifest.share_target.params[key], value);
  const { draft } = captureFromSearch("?" + query);
  assert.equal(draft.url, "https://b23.tv/abc");
  assert.equal(draft.title, "一个视频");
  assert.equal(
    draft.collection_id,
    "",
    "a share requires the administrator to choose a collection",
  );
});
test("service worker leaves API requests alone and reports offline navigation without caching it", async () => {
  const handlers = new Map<string, Function>();
  let responded = false;
  vm.runInNewContext(
    readFileSync(
      new URL("../../public/collector-sw.js", import.meta.url),
      "utf8",
    ),
    {
      self: {
        addEventListener: (name: string, handler: Function) =>
          handlers.set(name, handler),
      },
      fetch: async () => {
        throw new Error("offline");
      },
      Response,
    },
  );
  handlers.get("fetch")!({
    request: { method: "POST", mode: "cors" },
    respondWith: () => {
      responded = true;
    },
  });
  assert.equal(responded, false);
  let responsePromise: Promise<Response>;
  handlers.get("fetch")!({
    request: { method: "GET", mode: "navigate" },
    respondWith: (response: Promise<Response>) => {
      responsePromise = response;
    },
  });
  const response = await responsePromise!;
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(await response.text(), /收藏尚未保存/);
});
