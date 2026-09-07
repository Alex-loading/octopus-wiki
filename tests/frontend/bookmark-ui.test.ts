import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { after, afterEach, before, mock, test } from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";
import { createServer, type ViteDevServer } from "vite";

const require = createRequire(import.meta.url);
const { MemoryRouter, useLocation } = require(
  join(
    dirname(require.resolve("react-router/package.json")),
    "dist/development/index.js",
  ),
);
const cacheDir = mkdtempSync(join(tmpdir(), "octopus-bookmark-ui-"));
const boxId = "10000000-0000-0000-0000-000000000001";
const newBoxId = "10000000-0000-0000-0000-000000000002";
const box = {
  id: boxId,
  name: "技术",
  description: "",
  is_public: true,
  sort_order: 0,
};
const newBox = { ...box, id: newBoxId, name: "新收藏箱" };
let server: ViteDevServer,
  dom: JSDOM,
  root: Root | undefined,
  host: HTMLDivElement;
let repository: any,
  bookmarkRepository: any,
  context: any,
  Form: any,
  Collect: any,
  Admin: any;
const originals = new Map<string, PropertyDescriptor | undefined>();
let writes: { table: string; payload: any }[];
let failSave = false;
before(async () => {
  dom = new JSDOM("<!doctype html><body></body>", {
    url: "http://localhost",
    pretendToBeVisual: true,
  });
  for (const [name, value] of Object.entries({
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement,
    SVGElement: dom.window.SVGElement,
    Element: dom.window.Element,
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  }
  server = await createServer({
    configFile: false,
    envFile: false,
    cacheDir,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    esbuild: { jsx: "automatic" },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        "https://bookmark-test.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test"),
    },
  });
  repository = await server.ssrLoadModule("/src/app/content/repository.ts");
  bookmarkRepository = await server.ssrLoadModule(
    "/src/app/content/bookmarkRepository.ts",
  );
  context = await server.ssrLoadModule("/src/app/context/AdminAuthContext.tsx");
  ({ BookmarkForm: Form } = await server.ssrLoadModule(
    "/src/app/components/BookmarkForm.tsx",
  ));
  ({ Collect } = await server.ssrLoadModule("/src/app/pages/Collect.tsx"));
  ({ AdminBookmarks: Admin } = await server.ssrLoadModule(
    "/src/app/pages/AdminBookmarks.tsx",
  ));
});
afterEach(async () => {
  if (root) {
    await act(async () => root!.unmount());
    root = undefined;
  }
  host?.remove();
  mock.restoreAll();
});
after(async () => {
  await repository.getSupabaseClient().auth.stopAutoRefresh();
  repository.getSupabaseClient().auth.broadcastChannel?.close();
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});
function stubDatabase() {
  writes = [];
  failSave = false;
  const db = repository.getSupabaseClient();
  mock.method(db.auth, "getUser", async () => ({
    data: { user: { id: "admin", app_metadata: { role: "admin" } } },
    error: null,
  }));
  return mock.method(db, "from", (table: string) => {
    let payload: any;
    const query: any = {};
    for (const method of ["select", "eq", "order", "range"])
      query[method] = () => query;
    query.insert = (value: any) => {
      payload = value;
      writes.push({ table, payload });
      return query;
    };
    query.update = query.insert;
    query.single = async () => ({
      data:
        table === "bookmark_collections" ? newBox : { id: "saved", ...payload },
      error:
        failSave && table === "bookmarks"
          ? { message: "网络断开，请重试" }
          : null,
    });
    query.then = (resolve: any) =>
      Promise.resolve({
        data: table === "bookmark_collections" ? [box] : [],
        error: null,
      }).then(resolve);
    return query;
  });
}
function Probe() {
  const location = useLocation();
  return React.createElement(
    "output",
    { id: "location" },
    location.pathname + location.search,
  );
}
async function mount(element: React.ReactNode, role?: any, path = "/collect") {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  const content = role
    ? React.createElement(
        context.AdminAuthContext.Provider,
        {
          value: {
            checking: false,
            signingOut: false,
            signOut: async () => {},
            ...role,
          },
        },
        element,
      )
    : element;
  await act(async () =>
    root!.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [path] },
        content,
        React.createElement(Probe),
      ),
    ),
  );
}
async function change(label: string, value: string) {
  const input = host.querySelector(`[aria-label="${label}"]`)!;
  assert.ok(input, label);
  await act(async () => Simulate.change(input, { target: { value } } as any));
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((button) =>
    button.textContent?.includes(text),
  );
  assert.ok(button, text);
  await act(async () => button.click());
}

test("capture creates and selects a collection without losing a draft, then saves real fields", async () => {
  stubDatabase();
  let saved: any;
  function Wrapper() {
    const [boxes, setBoxes] = React.useState([box]);
    return React.createElement(Form, {
      collections: boxes,
      onCollectionCreated: (item: any) =>
        setBoxes((current) => [...current, item]),
      onSaved: (item: any) => {
        saved = item;
      },
    });
  }
  await mount(React.createElement(Wrapper));
  await change("链接或分享文案", "好内容 https://xhslink.com/a/abc");
  await change("标题", "我的收藏");
  await change("备注", "保留这个重点");
  await click("新建收藏箱");
  await change("新收藏箱名称", "新收藏箱");
  await click("创建并选中");
  assert.equal(
    (host.querySelector('[aria-label="收藏箱"]') as HTMLSelectElement).value,
    newBoxId,
  );
  assert.equal(
    (host.querySelector('[aria-label="标题"]') as HTMLInputElement).value,
    "我的收藏",
  );
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(saved.url, "https://xhslink.com/a/abc");
  assert.equal(saved.collection_id, newBoxId);
  assert.equal(saved.note, "保留这个重点");
  assert.equal(saved.platform, "xiaohongshu");
  assert.equal(writes.filter((write) => write.table === "bookmarks").length, 1);
});
test("failed saving retains the draft and never announces success", async () => {
  stubDatabase();
  failSave = true;
  let saved = false;
  await mount(
    React.createElement(Form, {
      collections: [box],
      initial: {
        url: "https://b23.tv/test",
        collection_id: boxId,
        title: "测试",
        cover_url: "",
        note: "备注",
        is_public: true,
      },
      onCollectionCreated() {},
      onSaved() {
        saved = true;
      },
    }),
  );
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(saved, false);
  assert.match(host.querySelector('[role="alert"]')!.textContent!, /网络断开/);
  assert.equal(
    (host.querySelector('[aria-label="备注"]') as HTMLTextAreaElement).value,
    "备注",
  );
  assert.equal(
    host.querySelector('button[type="submit"]')?.hasAttribute("disabled"),
    false,
  );
});
test("Android pasted sharing text remains saveable when Douyin metadata is unavailable", async () => {
  stubDatabase();
  mock.method(repository.getSupabaseClient().auth, "getSession", async () => ({ data: { session: { access_token: "test" } }, error: null }));
  let saved: any;
  mock.method(globalThis, "fetch", async () => Response.json({ success: false, message: "未读取到标题或封面，可以手动填写后保存。" }, { status: 422 }));
  const text = "3.84 复制打开抖音，看看【笑出苹果肌（万岁山搞笑没门版）的作品】这哥们儿真男人！# 万岁山武侠城 # 万岁山老嫂子... https://v.douyin.com/U3W4xeBm6Ns/ 10/21 b@N.jP FUY:/ :2pm";
  await mount(React.createElement(Form, {
    collections: [box], onCollectionCreated() {}, onSaved(item: any) { saved = item; },
  }));
  await change("链接或分享文案", text);
  assert.equal((host.querySelector('[aria-label="链接或分享文案"]') as HTMLTextAreaElement).value, text);
  assert.equal((host.querySelector('[aria-label="标题"]') as HTMLInputElement).value, "这哥们儿真男人！# 万岁山武侠城 # 万岁山老嫂子...");
  await click("读取标题与封面");
  assert.match(host.textContent!, /可以手动填写后保存/);
  await change("收藏箱", boxId);
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(saved.url, "https://v.douyin.com/U3W4xeBm6Ns/");
  assert.equal(saved.platform, "douyin");
  assert.equal(saved.cover_url, "");
  assert.match(saved.title, /^这哥们儿真男人/);
});
test("manual sharing text recognizes Xiaohongshu without overwriting an edited title", async () => {
  stubDatabase();
  await mount(React.createElement(Form, { collections: [box], onCollectionCreated() {}, onSaved() {} }));
  await change("链接或分享文案", "原来真的有这样真挚且幸福的父母爱情 https://xhslink.cn/o/8plZFEty9Hb 【小红书】里有答案");
  assert.equal((host.querySelector('[aria-label="标题"]') as HTMLInputElement).value, "原来真的有这样真挚且幸福的父母爱情");
  await change("标题", "我自己写的标题");
  await change("链接或分享文案", "另一个标题 https://xhslink.cn/o/another 【小红书】");
  assert.equal((host.querySelector('[aria-label="标题"]') as HTMLInputElement).value, "我自己写的标题");
  assert.match(host.querySelector(".bookmark-parsed")!.textContent!, /小红书.*another/);
});
test("a bare video link previews the title and signed cover without sharing text", async () => {
  stubDatabase();
  mock.method(repository.getSupabaseClient().auth, "getSession", async () => ({ data: { session: { access_token: "test" } }, error: null }));
  const url = "https://www.douyin.com/video/7681983811227372425";
  const title = "这哥们儿真男人！#万岁山武侠城 - 抖音";
  const cover = "https://p3-pc-sign.douyinpic.com/cover.jpeg?x-signature=abc%3D&x-expires=2104146000";
  const preview = mock.method(globalThis, "fetch", async (_url: string, options: RequestInit) => {
    assert.equal(JSON.parse(String(options.body)).url, url);
    return Response.json({ success: true, data: { title, cover_url: cover } });
  });
  await mount(React.createElement(Form, { collections: [box], onCollectionCreated() {}, onSaved() {} }));
  await change("链接或分享文案", url);
  assert.equal((host.querySelector('[aria-label="标题"]') as HTMLInputElement).value, "");
  await click("读取标题与封面");
  assert.equal(preview.mock.callCount(), 1);
  assert.equal((host.querySelector('[aria-label="标题"]') as HTMLInputElement).value, title);
  assert.equal((host.querySelector('[aria-label="封面链接"]') as HTMLInputElement).value, cover);
});
test("auto-filled share titles follow changed links, but successful preview respects manually edited titles", async () => {
  stubDatabase();
  mock.method(repository.getSupabaseClient().auth, "getSession", async () => ({ data: { session: { access_token: "test" } }, error: null }));
  mock.method(globalThis, "fetch", async () => Response.json({ success: true, data: { title: "网页完整标题", cover_url: "" } }));
  await mount(React.createElement(Form, { collections: [box], onCollectionCreated() {}, onSaved() {} }));
  await change("链接或分享文案", "第一条 https://xhslink.cn/o/first");
  await change("链接或分享文案", "第二条 https://xhslink.cn/o/second");
  assert.equal((host.querySelector('[aria-label="标题"]') as HTMLInputElement).value, "第二条");
  await click("读取标题与封面");
  assert.equal((host.querySelector('[aria-label="标题"]') as HTMLInputElement).value, "网页完整标题");
  assert.match(host.textContent!, /封面选填/);
  await change("标题", "手动标题");
  await click("读取标题与封面");
  assert.equal((host.querySelector('[aria-label="标题"]') as HTMLInputElement).value, "手动标题");
});
test("unauthorized sharing offers one-time login with encoded input and performs no private query", async () => {
  const from = stubDatabase();
  mock.method(globalThis, "fetch", async () =>
    Response.json({ success: true, data: { authorized: false } }),
  );
  const path =
    "/collect?" +
    new URLSearchParams({
      text: "标题 https://v.douyin.com/a/?q=1",
      title: "标题",
    });
  await mount(
    React.createElement(Collect, { darkMode: false }),
    { authenticated: false, isAdmin: false },
    path,
  );
  const destination = new URL(
    host.querySelector('a[href^="/admin/login"]')!.getAttribute("href")!,
    "https://wiki.example",
  );
  assert.equal(destination.pathname, "/admin/login");
  assert.equal(destination.searchParams.get("next"), path);
  assert.equal(from.mock.callCount(), 0);
  assert.equal(host.querySelector("#location")!.textContent!, path);
  assert.equal(host.querySelector("form"), null);
});

test("an authorized device collects without an administrator session or direct private database queries", async () => {
  const from = stubDatabase();
  const requests: any[] = [];
  mock.method(
    globalThis,
    "fetch",
    async (url: string, options: RequestInit) => {
      assert.equal(url, "/api/collector");
      assert.equal(options.credentials, "same-origin");
      assert.ok(!("Authorization" in options.headers!));
      const body = options.body ? JSON.parse(String(options.body)) : null;
      requests.push(body);
      return Response.json({
        success: true,
        data: !body
          ? {
              authorized: true,
              expiresAt: "2026-12-06T00:00:00Z",
              collections: [box],
            }
          : body.action === "create-collection"
            ? newBox
            : { id: "saved", ...body.draft },
      });
    },
  );
  await mount(
    React.createElement(Collect, { darkMode: false }),
    { authenticated: false, isAdmin: false },
    "/collect?url=https%3A%2F%2Fb23.tv%2Ftest&title=分享标题",
  );
  assert.match(host.textContent!, /本设备已启用免登录收藏/);
  assert.equal(host.querySelector('a[href^="/admin/login"]'), null);
  await change("备注", "新窗口收藏");
  await click("新建收藏箱");
  await change("新收藏箱名称", "新收藏箱");
  await click("创建并选中");
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.match(host.textContent!, /已收好/);
  assert.equal(from.mock.callCount(), 0);
  assert.equal(requests[2].action, "create-bookmark");
  assert.equal(requests[2].draft.title, "分享标题");
  assert.equal(requests[2].draft.note, "新窗口收藏");
  assert.equal(requests[2].draft.collection_id, newBoxId);
});

test("expired device writes keep the open draft so reauthorization in another tab can be followed by retry", async () => {
  const from = stubDatabase();
  let renewed = false;
  mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      if (options.method === "GET")
        return Response.json({
          success: true,
          data: {
            authorized: true,
            expiresAt: "2026-12-06T00:00:00Z",
            collections: [box],
          },
        });
      return renewed
        ? Response.json({
            success: true,
            data: { id: "saved", ...JSON.parse(String(options.body)).draft },
          })
        : Response.json(
            { success: false, message: "收藏授权已失效，请重新授权后重试。" },
            { status: 401 },
          );
    },
  );
  await mount(
    React.createElement(Collect, { darkMode: false }),
    { authenticated: false, isAdmin: false },
    "/collect?url=https%3A%2F%2Fb23.tv%2Ftest&title=保留的标题",
  );
  await change("收藏箱", boxId);
  await change("备注", "不能丢");
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.match(
    host.querySelector('[role="alert"]')!.textContent!,
    /授权已失效/,
  );
  assert.equal(
    (host.querySelector('[aria-label="备注"]') as HTMLTextAreaElement).value,
    "不能丢",
  );
  assert.equal(
    (host.querySelector('[aria-label="标题"]') as HTMLInputElement).value,
    "保留的标题",
  );
  renewed = true;
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.match(host.textContent!, /已收好/);
  assert.equal(from.mock.callCount(), 0);
});

test("administrator can enable and revoke device access without losing an in-progress capture", async () => {
  stubDatabase();
  mock.method(repository.getSupabaseClient().auth, "getSession", async () => ({
    data: { session: { access_token: "verified-admin" } },
    error: null,
  }));
  const actions: string[] = [];
  mock.method(
    globalThis,
    "fetch",
    async (_url: string, options: RequestInit) => {
      const body = options.body ? JSON.parse(String(options.body)) : null;
      if (body) actions.push(body.action);
      if (body?.action === "authorize")
        assert.equal(
          (options.headers as any).Authorization,
          "Bearer verified-admin",
        );
      return Response.json({
        success: true,
        data:
          body?.action === "authorize"
            ? {
                authorized: true,
                expiresAt: "2026-12-06T00:00:00Z",
                collections: [box],
              }
            : { authorized: false },
      });
    },
  );
  await mount(
    React.createElement(Collect, { darkMode: false }),
    { authenticated: true, isAdmin: true },
    "/collect?title=启用前的草稿",
  );
  await change("备注", "保留输入");
  await click("启用 90 天免登录收藏");
  assert.match(host.textContent!, /本设备已启用免登录收藏/);
  assert.equal(
    (host.querySelector('[aria-label="备注"]') as HTMLTextAreaElement).value,
    "保留输入",
  );
  await click("关闭本设备免登录");
  assert.match(host.textContent!, /已关闭本设备免登录收藏/);
  assert.deepEqual(actions, ["authorize", "revoke-current"]);
});
test("ordinary accounts cannot query or edit administrator resources", async () => {
  const from = stubDatabase();
  await mount(
    React.createElement(Admin, { darkMode: true }),
    { authenticated: true, isAdmin: false },
    "/admin/bookmarks",
  );
  assert.match(host.textContent!, /无权限访问/);
  assert.equal(from.mock.callCount(), 0);
  assert.equal(host.querySelector("form"), null);
});
test("late preview never overwrites manually edited title", async () => {
  stubDatabase();
  let resolve: any;
  mock.method(repository.getSupabaseClient().auth, "getSession", async () => ({
    data: { session: { access_token: "test-admin" } },
    error: null,
  }));
  mock.method(
    globalThis,
    "fetch",
    async () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  await mount(
    React.createElement(Form, {
      collections: [box],
      initial: {
        url: "https://b23.tv/test",
        title: "",
        collection_id: boxId,
        cover_url: "",
        note: "",
        is_public: true,
      },
      onCollectionCreated() {},
      onSaved() {},
    }),
  );
  await click("读取标题与封面");
  await change("标题", "手动标题");
  await act(async () =>
    resolve(
      Response.json({
        success: true,
        data: {
          title: "网络标题",
          cover_url: "https://images.example/test.png",
        },
      }),
    ),
  );
  assert.equal(
    (host.querySelector('[aria-label="标题"]') as HTMLInputElement).value,
    "手动标题",
  );
  assert.equal(
    (host.querySelector('[aria-label="封面链接"]') as HTMLInputElement).value,
    "https://images.example/test.png",
  );
});
test("public repository requests remain public even for an authenticated administrator", async () => {
  const requests: URL[] = [];
  mock.method(globalThis, "fetch", async (input: RequestInfo | URL) => {
    requests.push(
      new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
      ),
    );
    return Response.json([]);
  });
  await bookmarkRepository.listBookmarkCollections(false);
  await bookmarkRepository.listBookmarks();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].searchParams.get("is_public"), "eq.true");
  assert.equal(requests[1].searchParams.get("is_public"), "eq.true");
  assert.equal(
    requests[1].searchParams.get("bookmark_collections.is_public"),
    "eq.true",
  );
});
