import assert from "node:assert/strict";
import { after, afterEach, before, mock, test } from "node:test";
import { createServer, type ViteDevServer } from "vite";
import { emptyDemoDraft } from "../../src/app/content/demos.ts";

let server: ViteDevServer;
let repository: any;
const id = "11111111-1111-4111-8111-111111111111";
const row = { id, slug: "example", title: "真实项目", is_public: true, project_url: "https://github.com/octopus/wiki" };
before(async () => {
  server = await createServer({
    configFile: false, envFile: false, cacheDir: "/tmp/octopus-demo-repository-vite-cache",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    define: {
      "import.meta.env.VITE_CONTENT_SOURCE": JSON.stringify("static"),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://demo-test.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-key"),
    },
  });
  repository = await server.ssrLoadModule("/src/app/content/repository.ts");
});
afterEach(() => mock.restoreAll());
after(async () => { await server?.close(); });
function admin(metadata: any = { role: "admin" }) {
  mock.method(repository.getSupabaseClient().auth, "getUser", async () => ({ data: { user: { id, app_metadata: metadata } }, error: null }));
}

test("public projects always use the database and an explicit public predicate", async () => {
  mock.method(globalThis, "fetch", async (input: any) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/rest/v1/demos");
    assert.equal(url.searchParams.get("is_public"), "eq.true");
    assert.match(url.searchParams.get("order")!, /date.desc.nullslast,created_at.desc,id.asc/);
    return new Response(JSON.stringify([row, { ...row, id: "bad", project_url: "javascript:alert(1)" }]));
  });
  const items = await repository.listDemos();
  assert.equal(items.length, 2);
  assert.equal(items[0].githubUrl, row.project_url);
  assert.equal(items[1].githubUrl, "");
});

test("database errors and empty results never return sample projects", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response("[]"));
  assert.deepEqual(await repository.listDemos(), []);
  fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify({ code: "42703", message: "column missing" }), { status: 400 }));
  await assert.rejects(repository.listDemos(), /009_wonder_room.sql/);
});

test("project lists read all pages for accurate category totals and counts", async () => {
  let calls = 0;
  mock.method(globalThis, "fetch", async (input: any) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("offset"), String(calls * 500));
    calls++;
    return new Response(JSON.stringify(calls === 1 ? Array.from({ length: 500 }, (_, i) => ({ ...row, id: String(i) })) : [row]));
  });
  assert.equal((await repository.listDemos()).length, 501);
  assert.equal(calls, 2);
});

test("unverified and ordinary users cannot read administration data or mutate projects", async () => {
  admin({});
  const fetchMock = mock.method(globalThis, "fetch", async () => { throw new Error("must not access projects"); });
  await assert.rejects(repository.listDemos(true), /管理员/);
  await assert.rejects(repository.saveDemo({ ...emptyDemoDraft(), title: "作品", description: "简介" }), /管理员/);
  await assert.rejects(repository.deleteDemo(id), /管理员/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("admins can list private projects, create, edit and independently clear project links", async () => {
  admin({ is_admin: true });
  const writes: any[] = [];
  mock.method(globalThis, "fetch", async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("is_public"), null);
    if (!init?.method || init.method === "GET") return new Response(JSON.stringify([{ ...row, is_public: false }]));
    assert.ok(["POST", "PATCH"].includes(init.method));
    const payload = JSON.parse(String(init.body)); writes.push(payload);
    if (init.method === "PATCH") {
      assert.equal(url.searchParams.get("id"), `eq.${id}`);
      assert.equal(payload.slug, undefined, "editing must preserve existing slugs");
    } else assert.match(payload.slug, /^[0-9a-f-]{36}$/);
    return new Response(JSON.stringify({ ...row, ...payload }));
  });
  assert.equal((await repository.listDemos(true))[0].isPublic, false);
  const draft = { ...emptyDemoDraft(), title: "作品", description: "简介", deploymentUrl: "https://example.com/deployed", githubUrl: "https://github.com/example/project", isPublic: false };
  await repository.saveDemo(draft);
  const updated = await repository.saveDemo({ ...draft, deploymentUrl: "" }, id);
  const cleared = await repository.saveDemo({ ...draft, deploymentUrl: "", githubUrl: "" }, id);
  assert.equal(writes[0].demo_url, draft.deploymentUrl);
  assert.equal(writes[0].repo_url, draft.githubUrl);
  assert.equal(writes[0].project_url, null);
  assert.equal(writes[0].is_public, false);
  assert.equal(writes[1].project_url, null);
  assert.equal(writes[1].demo_url, null);
  assert.equal(updated.deploymentUrl, "");
  assert.equal(updated.githubUrl, draft.githubUrl);
  assert.equal(cleared.deploymentUrl, "");
  assert.equal(cleared.githubUrl, "");
});

test("delete checks affected rows and surfaces permission errors", async () => {
  admin();
  const fetchMock = mock.method(globalThis, "fetch", async (input: any, init?: RequestInit) => {
    assert.equal(init?.method, "DELETE");
    assert.equal(new URL(String(input)).searchParams.get("id"), `eq.${id}`);
    return new Response(JSON.stringify([{ id }]));
  });
  await repository.deleteDemo(id);
  fetchMock.mock.mockImplementation(async () => new Response("[]"));
  await assert.rejects(repository.deleteDemo(id), /不存在或没有删除权限/);
  fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify({ code: "42501" }), { status: 403 }));
  await assert.rejects(repository.deleteDemo(id), /没有操作权限/);
});

test("article-linked projects also exclude private and unpublished content", async () => {
  mock.method(globalThis, "fetch", async (input: any) => {
    const url = new URL(String(input));
    assert.equal(url.searchParams.get("demos.is_public"), "eq.true");
    assert.equal(url.searchParams.get("articles.status"), "eq.published");
    assert.equal(url.searchParams.get("articles.deleted_at"), "is.null");
    return new Response(JSON.stringify([{ demos: row }]));
  });
  assert.equal((await repository.listDemosByArticle("post"))[0].title, row.title);
});
