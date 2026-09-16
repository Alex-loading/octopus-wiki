import assert from "node:assert/strict";
import test from "node:test";
import { createBookmarksHandler } from "../../api/bookmarks.ts";
import { archiveBookmarkCover } from "../../api/_lib/bookmark-cover.ts";
import { saveStoredBookmark, validateSaveInput } from "../../api/_lib/bookmark-save.ts";

const draft = { collection_id: "10000000-0000-0000-0000-000000000001", title: "资源", url: "https://example.com/post", cover_url: "https://cdn.example/cover", note: "", is_public: false };

test("the shared admin/device saver writes only archived paths and preserves existing archives on edits", async () => {
  const writes: any[] = [];
  let archiveCalls = 0;
  const existing = { id: draft.collection_id, ...draft, cover_storage_path: "previous.png" };
  const client = { from: () => {
    let payload: any;
    const query: any = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: existing, error: null }),
      insert: (value: any) => { payload = value; writes.push(value); return query; },
      update: (value: any) => { payload = value; writes.push(value); return query; },
      single: async () => ({ data: { id: draft.collection_id, ...payload }, error: null }) };
    return query;
  } } as any;
  const archive = async () => { archiveCalls++; return "archived.png"; };
  await saveStoredBookmark(client, validateSaveInput(draft), undefined, archive);
  assert.equal(writes[0].cover_storage_path, "archived.png");
  assert.equal(writes[0].cover_url, draft.cover_url);
  await saveStoredBookmark(client, validateSaveInput({ ...draft, title: "修改标题" }), existing.id, archive);
  assert.equal(writes[1].cover_storage_path, "previous.png");
  assert.equal(archiveCalls, 1);
  await assert.rejects(saveStoredBookmark(client, validateSaveInput({ ...draft, cover_url: "https://new.example/image" }), existing.id,
    async () => { throw new Error("下载失败"); }), /下载失败/);
  assert.equal(writes.length, 2);
});
test("admin saves require authentication, reject malformed fields and ignore injected storage paths", async () => {
  const writes: any[] = [];
  const handler = createBookmarksHandler({
    isAdmin: async token => token === "admin",
    save: async (payload, id) => { writes.push({ payload, id }); return { ...payload, id: id ?? "new" } as any; },
  });
  const call = (body: unknown, token = "admin") => handler(new Request("https://wiki.example/api/bookmarks", {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  }));
  assert.equal((await call({ draft }, "fake")).status, 403);
  assert.equal(writes.length, 0);
  assert.equal((await call({ draft: { ...draft, is_public: "true" } })).status, 400);
  assert.equal((await call({ draft, id: "not-uuid" })).status, 400);
  const response = await call({ draft: { ...draft, cover_storage_path: "private.png", platform: "injected" } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(!("cover_storage_path" in writes[0].payload));
  assert.equal(writes[0].payload.platform, "other");
});

test("archive retries expired cover metadata, stores actual bytes once, and never uses a platform default logo", async () => {
  const uploads: any[] = [];
  const client = { storage: { from: () => ({ upload: async (...args: any[]) => { uploads.push(args); return { error: null }; } }) } } as any;
  const source = "https://expired.example/a";
  const dependencies = {
    download: async (url: string) => {
      if (url === source) throw new Error("403");
      return { bytes: Buffer.from("real-image-bytes"), extension: "png", contentType: "image/png" };
    },
    preview: async () => ({ title: "same post", cover_url: "https://new.example/a" }),
  };
  const path = await archiveBookmarkCover(client, source, draft.url, dependencies);
  assert.match(path, /^[a-f0-9]{64}\.png$/);
  assert.equal(uploads[0][1].toString(), "real-image-bytes");
  assert.equal(uploads[0][2].upsert, false);
  await assert.rejects(archiveBookmarkCover(client, source, draft.url, {
    ...dependencies, preview: async () => ({ title: "小红书", cover_url: "https://picasso-static.xiaohongshu.com/fe-platform/logo.png" }),
  }), /失效/);
  assert.equal(uploads.length, 1);
});
