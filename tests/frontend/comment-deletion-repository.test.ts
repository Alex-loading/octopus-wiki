import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, afterEach, before, mock, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let repository: Record<string, any>;
const cacheDir = mkdtempSync(join(tmpdir(), "octopus-comment-tests-"));
const articleId = "11111111-1111-4111-8111-111111111111";
const commentId = "22222222-2222-4222-8222-222222222222";

before(async () => {
  server = await createServer({
    configFile: false,
    cacheDir,
    envFile: false,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://comments-test.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-anon-key"),
    },
  });
  repository = await server.ssrLoadModule("/src/app/content/repository.ts");
});

afterEach(() => mock.restoreAll());
after(async () => {
  await server?.close();
  rmSync(cacheDir, { recursive: true, force: true });
});

function setUser(appMetadata: Record<string, unknown> | null, userMetadata = {}) {
  mock.method(repository.getSupabaseClient().auth, "getUser", async () => ({
    data: { user: appMetadata === null ? null : {
      id: "33333333-3333-4333-8333-333333333333",
      app_metadata: appMetadata,
      user_metadata: userMetadata,
    } },
    error: null,
  }));
}

function requireDelete() {
  assert.equal(typeof repository.deleteArticleComment, "function", "admin comment deletion should exist");
  return repository.deleteArticleComment;
}

test("rejects guests, non-admins and spoofed user metadata without sending DELETE", async () => {
  const remove = requireDelete();
  const fetch = mock.method(globalThis, "fetch", async () => { throw new Error("unexpected network request"); });
  for (const metadata of [null, {}, { role: "reader" }, { is_admin: false }]) {
    setUser(metadata, { role: "admin", is_admin: true });
    const result = await remove(articleId, commentId);
    assert.equal(result.ok, false);
    assert.match(result.error, /管理员/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

for (const metadata of [{ role: "admin" }, { is_admin: true }]) {
  test(`deletes only the requested comment and article for admin ${JSON.stringify(metadata)}`, async () => {
    const remove = requireDelete();
    setUser(metadata);
    const fetch = mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      assert.equal(init?.method, "DELETE");
      assert.equal(url.pathname, "/rest/v1/article_comments");
      assert.equal(url.searchParams.get("id"), `eq.${commentId}`);
      assert.equal(url.searchParams.get("article_id"), `eq.${articleId}`);
      assert.equal(url.searchParams.get("select"), "id");
      return new Response(JSON.stringify({ id: commentId }), { status: 200 });
    });
    assert.deepEqual(await remove(articleId, commentId), { ok: true, data: { id: commentId } });
    assert.equal(fetch.mock.callCount(), 1);
  });
}

test("does not report a zero-row deletion as success", async () => {
  const remove = requireDelete();
  setUser({ role: "admin" });
  mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "The result contains 0 rows",
  }), { status: 406 }));
  const result = await remove(articleId, commentId);
  assert.equal(result.ok, false);
  assert.match(result.error, /不存在|已被删除|权限/);
});

test("surfaces database permission failures", async () => {
  const remove = requireDelete();
  setUser({ role: "admin" });
  mock.method(globalThis, "fetch", async () => new Response(JSON.stringify({
    code: "42501", message: "permission denied for table article_comments",
  }), { status: 403 }));
  const result = await remove(articleId, commentId);
  assert.equal(result.ok, false);
  assert.match(result.error, /权限/);
});

test("returns a recoverable failure when the auth lookup throws", async () => {
  const remove = requireDelete();
  mock.method(repository.getSupabaseClient().auth, "getUser", async () => { throw new Error("Failed to fetch"); });
  const result = await remove(articleId, commentId);
  assert.equal(result.ok, false);
  assert.match(result.error, /网络/);
});
