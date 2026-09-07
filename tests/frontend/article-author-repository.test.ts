import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";
import { createServer as createHttpServer } from "node:http";

let server: ViteDevServer;
let repository: Record<string, any>;
const id = "11111111-1111-4111-8111-111111111111";
const input = {
  title: "署名测试", slug: "author-test", excerpt: "", category: "技术", tags: [],
  contentSnapshot: "正文", feishuDocUrl: "https://example.feishu.cn/docx/Example",
};

before(async () => {
  server = await createServer({
    configFile: false, envFile: false, cacheDir: "/tmp/octopus-author-test-vite-cache",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: { server: createHttpServer() }, watch: null },
    define: {
      "import.meta.env.VITE_CONTENT_SOURCE": JSON.stringify("database"),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://author-test.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-key"),
    },
  });
  repository = await server.ssrLoadModule("/src/app/content/repository.ts");
});
afterEach(() => mock.restoreAll());
after(async () => { await server?.close(); });

test("reads custom author metadata and handles older or unknown values", async () => {
  mock.method(globalThis, "fetch", async (request: string | URL | Request) => {
    const url = new URL(String(request));
    assert.match(url.searchParams.get("select")!, /author_name,author_avatar/);
    return new Response(JSON.stringify([
      { id, slug: "custom", title: "Custom", author_name: " 摸鱼中的 Octopus ", author_avatar: "chill" },
      { id, slug: "legacy", title: "Legacy", author_name: null, author_avatar: "obsolete" },
    ]), { status: 200 });
  });
  const articles = await repository.listArticles();
  assert.equal(articles[0].authorName, "摸鱼中的 Octopus");
  assert.equal(articles[0].authorAvatar, "chill");
  assert.equal(articles[1].authorName, undefined);
  assert.equal(articles[1].authorAvatar, "everyday");
});

for (const operation of ["create", "update"]) {
  test(`${operation} saves custom signature and can clear it back to default`, async () => {
    mock.method(repository.getSupabaseClient().auth, "getUser", async () => ({
      data: { user: { id, app_metadata: { role: "admin" } } }, error: null,
    }));
    const writes: Record<string, unknown>[] = [];
    mock.method(globalThis, "fetch", async (request: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(request));
      assert.equal(url.pathname, "/rest/v1/articles");
      if (!init?.method || init.method === "GET") return new Response("[]", { status: 200 });
      assert.equal(init.method, operation === "create" ? "POST" : "PATCH");
      if (operation === "update") assert.equal(url.searchParams.get("id"), `eq.${id}`);
      writes.push(JSON.parse(String(init.body)));
      return new Response(null, { status: 204 });
    });
    for (const metadata of [{ authorName: " 困困的 Octopus ", authorAvatar: "sleepy" }, { authorName: "  ", authorAvatar: "" }]) {
      const result = operation === "create"
        ? await repository.createArticle({ ...input, ...metadata })
        : await repository.updateArticle(id, { ...input, ...metadata });
      assert.equal(result.ok, true, result.error);
    }
    assert.equal(writes.length, 2);
    assert.equal(writes[0].author_name, "困困的 Octopus");
    assert.equal(writes[0].author_avatar, "sleepy");
    assert.equal(writes[1].author_name, null);
    assert.equal(writes[1].author_avatar, "everyday");
    assert.equal(writes[1].content_md, "正文");
  });
}
