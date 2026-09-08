import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { after, afterEach, before, beforeEach, mock, test } from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";
import { createServer, type ViteDevServer } from "vite";

const require = createRequire(import.meta.url);
const { MemoryRouter, useLocation } = require(join(dirname(require.resolve("react-router/package.json")), "dist/development/index.js"));
const cacheDir = mkdtempSync(join(tmpdir(), "octopus-demo-ui-"));
let server: ViteDevServer, dom: JSDOM, root: Root | undefined, host: HTMLDivElement;
let repository: any, context: any, Lab: any, AdminDemos: any;
let rows: any[], failRead: boolean, failWrite: boolean, writes: any[], reads: number;
const originals = new Map<string, PropertyDescriptor | undefined>();
const id = "11111111-1111-4111-8111-111111111111";
const fixture = { id, slug: "project", title: "真实作品", description: "卡片简介", long_description: "项目详情\n第二行", category: "工具", tags: ["React"], tech_stack: ["TypeScript"], status: "live", colors: ["#6366f1", "#8b5cf6"], icon: "✦", date: "2026-09", is_public: true, demo_url: "https://example.com/app", repo_url: "https://github.com/example/project", project_url: null };
const admin = { authenticated: true, isAdmin: true, userId: "admin", checking: false };
const guest = { authenticated: false, isAdmin: false, userId: null, checking: false };

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
  const globals: Record<string, unknown> = { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, IS_REACT_ACT_ENVIRONMENT: true,
    getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window), cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IntersectionObserver: class { observe() {} unobserve() {} disconnect() {} },
  };
  for (const name of ["HTMLElement", "HTMLInputElement", "HTMLButtonElement", "SVGElement", "Element", "Node", "NodeFilter", "DocumentFragment", "HTMLSelectElement", "MutationObserver", "CustomEvent", "Event"])
    globals[name] = (dom.window as any)[name];
  for (const [name, value] of Object.entries(globals)) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  server = await createServer({ configFile: false, envFile: false, cacheDir,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, esbuild: { jsx: "automatic" },
    define: { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://demo-ui.supabase.co"), "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test") },
  });
  repository = await server.ssrLoadModule("/src/app/content/repository.ts");
  context = await server.ssrLoadModule("/src/app/context/AdminAuthContext.tsx");
  ({ Lab } = await server.ssrLoadModule("/src/app/pages/Lab.tsx"));
  ({ AdminDemos } = await server.ssrLoadModule("/src/app/pages/AdminDemos.tsx"));
});
beforeEach(() => {
  rows = [{ ...fixture }]; failRead = false; failWrite = false; writes = []; reads = 0;
  mock.method(repository.getSupabaseClient().auth, "getUser", async () => ({ data: { user: { id: "admin", app_metadata: { role: "admin" } } }, error: null }));
  mock.method(globalThis, "fetch", async (input: any, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(url.pathname, "/rest/v1/demos");
    const method = init?.method ?? "GET";
    if (method === "GET") {
      reads++;
      if (failRead) return new Response(JSON.stringify({ message: "读取失败" }), { status: 400 });
      return new Response(JSON.stringify(rows.filter(row => !url.searchParams.has("is_public") || row.is_public)));
    }
    if (failWrite) return new Response(JSON.stringify({ message: "保存失败，请重试" }), { status: 400 });
    const targetId = url.searchParams.get("id")?.replace("eq.", "");
    if (method === "DELETE") { rows = rows.filter(row => row.id !== targetId); return new Response(JSON.stringify([{ id: targetId }])); }
    const payload = JSON.parse(String(init?.body)); writes.push(payload);
    const item = { ...fixture, ...payload, id: targetId ?? "22222222-2222-4222-8222-222222222222" };
    rows = method === "POST" ? [...rows, item] : rows.map(row => row.id === targetId ? item : row);
    return new Response(JSON.stringify(item));
  });
});
afterEach(async () => {
  if (root) { await act(async () => root!.unmount()); root = undefined; }
  host?.remove(); mock.restoreAll();
});
after(async () => {
  await repository.getSupabaseClient().auth.stopAutoRefresh();
  repository.getSupabaseClient().auth.broadcastChannel?.close();
  await server?.close(); dom.window.close(); rmSync(cacheDir, { recursive: true, force: true });
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
  }
});
function Probe() { const location = useLocation(); return React.createElement("output", { id: "location" }, location.pathname + location.search); }
async function mount(page: "public" | "admin", role: any = admin) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(React.createElement(context.AdminAuthContext.Provider, { value: { ...role, signingOut: false, signOut: async () => {} } },
    React.createElement(MemoryRouter, { initialEntries: [page === "public" ? "/lab" : "/admin/demos"] }, React.createElement(page === "public" ? Lab : AdminDemos, { darkMode: false }), React.createElement(Probe)))));
}
async function mountWithAuth() {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(React.createElement(context.AdminAuthProvider, null,
    React.createElement(MemoryRouter, { initialEntries: ["/admin/demos"] }, React.createElement(AdminDemos, { darkMode: false }), React.createElement(Probe)))));
}
function button(text: string, scope: ParentNode = host) { const result = [...scope.querySelectorAll<HTMLButtonElement>("button")].find(item => item.textContent?.trim() === text); assert.ok(result, `button ${text}`); return result; }
async function click(text: string) { await act(async () => button(text).click()); }
async function change(name: string, value: string) {
  await act(async () => Simulate.change(host.querySelector(`[name="${name}"]`)!, { target: { value } } as any));
}

test("all project cards say learn more and details show separate optional deployment and GitHub links", async () => {
  rows.push({ ...fixture, id: "second", title: "计划作品", status: "planned", demo_url: null, repo_url: null, project_url: null, category: "交互" });
  await mount("public");
  assert.equal(host.querySelector("h1")?.textContent?.trim(), "妙妙屋");
  assert.equal(host.querySelectorAll("article").length, 2);
  assert.equal([...host.querySelectorAll("article button")].every(item => item.textContent?.trim() === "了解更多"), true);
  assert.doesNotMatch(host.textContent!, /查看 Demo|实验室|粒子涌现/);
  await click("了解更多");
  const dialog = document.querySelector('[role="dialog"]')!;
  assert.ok(dialog);
  assert.match(dialog.textContent!, /项目详情/);
  const links = [...dialog.querySelectorAll("a")];
  assert.deepEqual(links.map(link => [link.textContent?.trim(), link.href]), [["部署链接", fixture.demo_url], ["GitHub 仓库", fixture.repo_url]]);
  for (const link of links) {
    assert.equal(link.target, "_blank");
    assert.equal(link.rel, "noopener noreferrer");
  }
  assert.doesNotMatch(dialog.textContent!, /Coming Soon|即将开放/);
  await act(async () => dialog.querySelector<HTMLButtonElement>('button[aria-label="关闭项目详情"]')!.click());
  // AnimatePresence removes the closing modal after its exit transition.
  await act(async () => new Promise(resolve => setTimeout(resolve, 350)));
  await act(async () => host.querySelectorAll<HTMLButtonElement>("article button")[1].click());
  assert.equal(document.querySelector('[role="dialog"] a'), null);
});

test("empty and failed real-data loads have distinct states and retry works", async () => {
  rows = []; await mount("public");
  assert.match(host.textContent!, /妙妙屋正在布置中/);
  assert.equal(host.querySelectorAll("article").length, 0);
  await act(async () => root!.unmount()); root = undefined; host.remove();
  failRead = true; await mount("public");
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? "", /暂时无法加载/);
  failRead = false; rows = [fixture]; await click("重新加载");
  assert.equal(host.querySelectorAll("article").length, 1);
});

for (const kind of ["deployment", "github"]) {
  test(`details show only the ${kind} link when the other is blank`, async () => {
    rows = [{ ...fixture, demo_url: kind === "deployment" ? fixture.demo_url : null, repo_url: kind === "github" ? fixture.repo_url : null }];
    await mount("public"); await click("了解更多");
    const links = document.querySelectorAll('[role="dialog"] a');
    assert.equal(links.length, 1);
    assert.equal(links[0].textContent?.trim(), kind === "deployment" ? "部署链接" : "GitHub 仓库");
  });
}

test("guests return to the requested management page after login and non-admins never load records", async () => {
  await mount("admin", guest);
  assert.equal(host.querySelector("#location")?.textContent, "/admin/login?next=%2Fadmin%2Fdemos");
  assert.equal(reads, 0);
  await act(async () => root!.unmount()); root = undefined; host.remove();
  await mount("admin", { ...guest, authenticated: true });
  assert.match(host.textContent!, /无权限访问/);
  assert.equal(reads, 0);
  assert.equal(host.querySelector("form"), null);
});

test("admins create a project and retain input after failed saves", async () => {
  rows = []; await mount("admin"); await click("新增项目");
  await change("title", "我的新作品"); await change("description", "真实的介绍");
  await change("deploymentUrl", "https://example.com/deployed");
  await change("githubUrl", "https://github.com/example/new-project");
  await change("tags", "React，SVG");
  failWrite = true;
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? "", /保存失败/);
  assert.equal(host.querySelector<HTMLInputElement>('[name="title"]')?.value, "我的新作品");
  failWrite = false;
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(host.querySelector("form"), null);
  assert.match(host.textContent!, /我的新作品/);
  assert.equal(writes[0].demo_url, "https://example.com/deployed");
  assert.equal(writes[0].repo_url, "https://github.com/example/new-project");
  assert.equal(writes[0].project_url, null);
  assert.deepEqual(writes[0].tags, ["React", "SVG"]);
});

for (const action of ["新增项目", "编辑"]) {
  test(`${action} preserves the mounted editor and unsaved fields during same-user tab refocus and token refresh`, async () => {
    const auth = repository.getSupabaseClient().auth;
    let notify!: (event: string, session: unknown) => void;
    mock.method(auth, "onAuthStateChange", (callback: typeof notify) => {
      notify = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    });
    await mountWithAuth(); await click(action);
    const fields = {
      title: "尚未保存的简历匣", description: "切出去查资料，回来继续写", longDescription: "详情第一行\n详情第二行",
      deploymentUrl: "https://example.com/draft", githubUrl: "https://github.com/Alex-loading/resume-assistant",
      category: "效率工具", tags: "求职, 简历", techStack: "JavaScript, CSS", status: "wip", date: "2026-09",
    };
    for (const [name, value] of Object.entries(fields)) await change(name, value);
    const form = host.querySelector("form");
    assert.ok(form);
    const previousReads = reads;
    for (const event of ["SIGNED_IN", "TOKEN_REFRESHED", "SIGNED_IN"]) {
      let finishLookup!: (result: unknown) => void;
      const started = new Promise<void>(resolve => {
        auth.getUser.mock.mockImplementation(() => {
          resolve();
          return new Promise(done => { finishLookup = done; });
        });
      });
      // Supabase emits SIGNED_IN when visibility changes from hidden to visible.
      await act(async () => notify(event, { user: { id: "admin" } }));
      await act(async () => started);
      const pendingForm = host.querySelector("form");
      await act(async () => finishLookup({ data: { user: { id: "admin", app_metadata: { role: "admin" } } }, error: null }));
      assert.equal(pendingForm, form, "background role verification must not unmount the editor");
      assert.equal(host.querySelector("form"), form, "verification must preserve the editor instance");
      for (const [name, value] of Object.entries(fields)) {
        assert.equal(host.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value, value, `${name} survives ${event}`);
      }
      assert.equal(host.querySelector("#location")?.textContent, "/admin/demos");
      assert.equal(reads, previousReads, "tab refocus must not remount management and reload records");
    }
    assert.equal(writes.length, 0, "switching tabs must not implicitly save a draft");
  });
}

test("editing fills existing values, supports clearing one link without changing the other and hiding the project", async () => {
  await mount("admin"); await click("编辑");
  assert.equal(host.querySelector<HTMLInputElement>('[name="deploymentUrl"]')?.value, fixture.demo_url);
  assert.equal(host.querySelector<HTMLInputElement>('[name="githubUrl"]')?.value, fixture.repo_url);
  await change("deploymentUrl", "");
  await act(async () => Simulate.change(host.querySelector('[name="isPublic"]')!, { target: { checked: false } } as any));
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(writes[0].project_url, null);
  assert.equal(writes[0].demo_url, null);
  assert.equal(writes[0].repo_url, fixture.repo_url);
  assert.equal(writes[0].is_public, false);
  assert.match(host.textContent!, /仅管理员可见/);
});

test("deletion requires confirmation, retains records on failure, and refreshes on success", async () => {
  await mount("admin");
  dom.window.confirm = () => false; await click("删除"); assert.equal(rows.length, 1);
  dom.window.confirm = () => true; failWrite = true; await click("删除");
  assert.equal(rows.length, 1); assert.ok(host.querySelector('[role="alert"]'));
  failWrite = false; await click("删除");
  assert.equal(rows.length, 0); assert.match(host.textContent!, /项目已删除/);
});
