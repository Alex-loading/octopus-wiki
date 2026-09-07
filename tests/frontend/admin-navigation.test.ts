import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { after, afterEach, before, mock, test } from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Simulate } from "react-dom/test-utils";
import { JSDOM } from "jsdom";
import { createServer, type ViteDevServer } from "vite";

// Vite 6 resolves CJS, while Node 20's module-sync condition resolves ESM.
// Load the package's CJS main explicitly so both sides share the Router context.
const require = createRequire(import.meta.url);
const { MemoryRouter, useLocation } = require(join(dirname(require.resolve("react-router/package.json")), "dist/development/index.js"));

let server: ViteDevServer;
let repository: Record<string, any>;
let authContext: Record<string, any>;
let Navbar: React.ComponentType<any>;
let AdminLogin: React.ComponentType<any>;
let AdminArticles: React.ComponentType<any>;
let dom: JSDOM;
let root: Root | undefined;
let host: HTMLDivElement;
const cacheDir = mkdtempSync(join(tmpdir(), "octopus-admin-nav-"));
const originals = new Map<string, PropertyDescriptor | undefined>();
let authCallback: (event: string, session: any) => void;
const admin = { authenticated: true, isAdmin: true, userId: "admin", checking: false };
const guest = { authenticated: false, isAdmin: false, userId: null, checking: false };

before(async () => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost", pretendToBeVisual: true });
  for (const [name, value] of Object.entries({
    window: dom.window, document: dom.window.document, navigator: dom.window.navigator,
    HTMLElement: dom.window.HTMLElement, SVGElement: dom.window.SVGElement, Element: dom.window.Element,
    requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window),
    cancelAnimationFrame: dom.window.cancelAnimationFrame.bind(dom.window),
    IS_REACT_ACT_ENVIRONMENT: true,
  })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
  }
  server = await createServer({
    configFile: false, envFile: false, cacheDir,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    esbuild: { jsx: "automatic" },
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://admin-nav-test.supabase.co"),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify("test-anon-key"),
    },
  });
  repository = await server.ssrLoadModule("/src/app/content/repository.ts");
});

afterEach(async () => {
  if (root) { await act(async () => root!.unmount()); root = undefined; }
  host?.remove();
  mock.restoreAll();
  dom.reconfigure({ url: "http://localhost" });
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

async function loadUI() {
  assert.equal(existsSync(new URL("../../src/app/context/AdminAuthContext.tsx", import.meta.url)), true, "shared administrator context should exist");
  authContext = await server.ssrLoadModule("/src/app/context/AdminAuthContext.tsx");
  ({ Navbar } = await server.ssrLoadModule("/src/app/components/Navbar.tsx"));
  ({ AdminLogin } = await server.ssrLoadModule("/src/app/pages/AdminLogin.tsx"));
  ({ AdminArticles } = await server.ssrLoadModule("/src/app/pages/AdminArticles.tsx"));
}

function LocationProbe() {
  const location = useLocation();
  return React.createElement("output", { id: "location" }, location.pathname + location.search + location.hash);
}

async function mount(role: typeof admin | typeof guest, options: { signOut?: () => Promise<void>; page?: "login" | "articles"; path?: string } = {}) {
  await loadUI();
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  const content = options.page === "login" ? React.createElement(AdminLogin, { darkMode: false })
    : options.page === "articles" ? React.createElement(AdminArticles, { darkMode: false })
    : React.createElement(Navbar, { darkMode: false, toggleDarkMode() {}, onSearchOpen() {} });
  await act(async () => root!.render(React.createElement(authContext.AdminAuthContext.Provider, {
    value: { ...role, signingOut: false, signOut: options.signOut ?? (async () => {}) },
  }, React.createElement(MemoryRouter, { initialEntries: [options.path ?? "/post/example?view=1#part"] }, content, React.createElement(LocationProbe)))));
}

test("repository persists auth only in configured tab storage and local signout propagates errors", async () => {
  const client = repository.getSupabaseClient();
  assert.equal(client.auth.persistSession, true, "auth must survive tab reloads");
  client.auth.storage.setItem("admin-nav-test", "value");
  assert.equal(window.sessionStorage.getItem("admin-nav-test"), "value");
  assert.equal(window.localStorage.getItem("admin-nav-test"), null);
  client.auth.storage.removeItem("admin-nav-test");
  mock.method(client.auth, "signOut", async (options: unknown) => {
    assert.deepEqual(options, { scope: "local" });
    return { error: new Error("offline") };
  });
  await assert.rejects(repository.signOutAdmin(), /offline/);
});

test("readers see a pixel octopus, no management links, and a five-click login entry", async () => {
  await mount(guest);
  assert.equal(host.querySelector('a[href="/admin/articles"]'), null);
  const logo = host.querySelector<HTMLButtonElement>('button[aria-label="Octopus"]');
  assert.ok(logo);
  assert.ok(logo.querySelector('svg[shape-rendering="crispEdges"]'));
  assert.equal(logo.querySelector("svg > g")?.getAttribute("fill"), "#818CF8");
  assert.ok(logo.classList.contains("focus-visible:outline-indigo-500"));
  for (let i = 0; i < 4; i++) await act(async () => logo.click());
  assert.match(host.querySelector("#location")!.textContent!, /^\/post\/example/);
  await act(async () => logo.click());
  const location = host.querySelector("#location")!.textContent!;
  assert.equal(location, "/admin/login?next=%2Fpost%2Fexample%3Fview%3D1%23part");
  assert.equal(host.querySelector('a[aria-label="返回首页"]')?.getAttribute("href"), "/");
});

test("verified admins see crowned artwork and article links in desktop and mobile navigation", async () => {
  let signedOut = false;
  await mount(admin, { signOut: async () => { signedOut = true; } });
  assert.equal(host.querySelectorAll('a[href="/admin/articles"]').length, 1);
  assert.ok(host.querySelector('[data-admin-crown="true"]'));
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="打开菜单"]')!.click());
  assert.equal(host.querySelectorAll('a[href="/admin/articles"]').length, 2);
  window.confirm = () => false;
  const logo = host.querySelector<HTMLButtonElement>('button[aria-label="退出管理员模式"]')!;
  await act(async () => logo.click());
  assert.equal(signedOut, false);
  window.confirm = () => true;
  await act(async () => logo.click());
  assert.equal(signedOut, true);
});

test("unverified admin metadata never exposes management navigation", async () => {
  await mount({ ...admin, checking: true });
  assert.equal(host.querySelector('a[href="/admin/articles"]'), null);
  assert.equal(host.querySelector('[data-admin-crown="true"]'), null);
});

test("logout failure is visible instead of pretending the user signed out", async () => {
  await mount(admin, { signOut: async () => { throw new Error("退出失败，请重试。"); } });
  window.confirm = () => true;
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="退出管理员模式"]')!.click());
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? "", /退出失败/);
  assert.ok(host.querySelector('a[href="/admin/articles"]'));
});

test("login redirects a verified administrator to the requested article", async () => {
  await mount(admin, { page: "login", path: "/admin/login?next=%2Fpost%2Fexample%23comments" });
  assert.equal(host.querySelector("#location")?.textContent, "/post/example#comments");
});

test("login email uses a same-origin callback, validates next and never creates new users", async () => {
  await mount(guest, { page: "login", path: "/admin/login?next=%2F%2Fevil.example" });
  const send = mock.method(repository.getSupabaseClient().auth, "signInWithOtp", async (payload: any) => {
    assert.equal(payload.email, "admin@example.com");
    assert.equal(payload.options.shouldCreateUser, false);
    assert.equal(payload.options.emailRedirectTo, "http://localhost/admin/login?next=%2Fadmin%2Farticles");
    return { data: { user: null, session: null }, error: null };
  });
  const input = host.querySelector("input")!;
  await act(async () => Simulate.change(input, { target: { value: "admin@example.com" } } as any));
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(send.mock.callCount(), 1);
  assert.match(host.querySelector('[role="status"]')?.textContent ?? "", /验证码已发送/);
  assert.ok(host.querySelector('input[autocomplete="one-time-code"]'));
  const resend = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("秒后可重新发送"))!;
  assert.equal(resend.disabled, true);
});

test("production magic links return to the production login callback and retain shared bookmark input", async () => {
  dom.reconfigure({ url: "https://octopus-wiki.vercel.app/admin/login" });
  const next = "/collect?" + new URLSearchParams({ url: "https://b23.tv/example", title: "线上收藏" });
  await mount(guest, { page: "login", path: "/admin/login?next=" + encodeURIComponent(next) });
  let redirect: URL | undefined;
  const send = mock.method(repository.getSupabaseClient().auth, "signInWithOtp", async (payload: any) => {
    redirect = new URL(payload.options.emailRedirectTo);
    assert.equal(payload.options.shouldCreateUser, false);
    return { data: { user: null, session: null }, error: null };
  });
  await act(async () => Simulate.change(host.querySelector("input")!, { target: { value: "admin@example.com" } } as any));
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(send.mock.callCount(), 1);
  assert.equal(redirect!.origin, "https://octopus-wiki.vercel.app");
  assert.equal(redirect!.pathname, "/admin/login");
  assert.equal(redirect!.searchParams.get("next"), next);
  assert.ok(!redirect!.href.includes("localhost"));
});

async function enterExistingCode(value = "12345678") {
  await act(async () => Simulate.change(host.querySelector('input[type="email"]')!, { target: { value: "admin@example.com" } } as any));
  await act(async () => [...host.querySelectorAll("button")].find(button => button.textContent === "已有验证码，直接输入")!.click());
  const input = host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
  assert.ok(input);
  assert.equal(input.inputMode, "numeric");
  await act(async () => Simulate.change(input, { target: { value } } as any));
}

test("an existing email code can be verified in the current app without sending another email", async () => {
  await mount(guest, { page: "login", path: "/admin/login?next=%2Fcollect%2Fsetup" });
  const send = mock.method(repository.getSupabaseClient().auth, "signInWithOtp", async () => { throw new Error("Must not resend"); });
  const verify = mock.method(repository.getSupabaseClient().auth, "verifyOtp", async (payload: any) => {
    assert.deepEqual(payload, { email: "admin@example.com", token: "12345678", type: "email" });
    return { data: { session: { user: { id: "admin" } } }, error: null };
  });
  await enterExistingCode("1234 5678");
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(verify.mock.callCount(), 1);
  assert.equal(send.mock.callCount(), 0);
  assert.match(host.textContent ?? "", /正在确认管理员权限/);
  assert.equal(host.querySelector("#location")?.textContent, "/admin/login?next=%2Fcollect%2Fsetup", "OTP response alone must not grant administrator access");
});

test("invalid and expired codes keep the user in the app and allow a corrected retry", async () => {
  await mount(guest, { page: "login", path: "/admin/login?next=%2Fcollect%2Fsetup" });
  const verify = mock.method(repository.getSupabaseClient().auth, "verifyOtp", async () => ({ data: { session: null }, error: new Error("Token expired") }));
  await enterExistingCode("12ab");
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(verify.mock.callCount(), 0);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? "", /完整数字验证码/);
  const input = host.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]')!;
  await act(async () => Simulate.change(input, { target: { value: "123456" } } as any));
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(verify.mock.callCount(), 1);
  assert.equal(input.value, "123456");
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? "", /验证失败/);
  verify.mock.mockImplementation(async () => ({ data: { session: { user: { id: "admin" } } }, error: null }));
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(verify.mock.callCount(), 2);
  assert.equal(host.querySelector('[role="alert"]'), null);
});

test("failed email delivery does not switch to code entry or block retry", async () => {
  await mount(guest, { page: "login", path: "/admin/login" });
  mock.method(repository.getSupabaseClient().auth, "signInWithOtp", async () => ({ data: { user: null, session: null }, error: new Error("发送频率受限，请稍后重试") }));
  await act(async () => Simulate.change(host.querySelector("input")!, { target: { value: "admin@example.com" } } as any));
  await act(async () => Simulate.submit(host.querySelector("form")!));
  assert.equal(host.querySelector('input[autocomplete="one-time-code"]'), null);
  assert.equal(host.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled, false);
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? "", /发送频率受限/);
});

for (const role of ["admin", "reader"]) {
  test(`email OTP waits for verified ${role} role before returning to the shared collection`, async () => {
    await loadUI();
    let signedIn = false;
    const client = repository.getSupabaseClient();
    mock.method(client.auth, "onAuthStateChange", (callback: typeof authCallback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    });
    const readUser = mock.method(client.auth, "getUser", async () => ({ data: { user: signedIn ? { id: role, app_metadata: { role } } : null }, error: null }));
    mock.method(client.auth, "verifyOtp", async () => {
      signedIn = true;
      const session = { user: { id: role, app_metadata: { role: "admin" } } };
      authCallback("SIGNED_IN", session);
      return { data: { session }, error: null };
    });
    const next = "/collect?" + new URLSearchParams({ url: "https://b23.tv/example", title: "手机收藏" });
    const path = "/admin/login?next=" + encodeURIComponent(next);
    host = document.createElement("div"); document.body.append(host); root = createRoot(host);
    await act(async () => root!.render(React.createElement(authContext.AdminAuthProvider, null,
      React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AdminLogin, { darkMode: false }), React.createElement(LocationProbe)))));
    await enterExistingCode();
    await act(async () => {
      Simulate.submit(host.querySelector("form")!);
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    assert.ok(readUser.mock.callCount() >= 2);
    assert.equal(host.querySelector("#location")?.textContent, role === "admin" ? next : path);
    if (role === "reader") assert.match(host.textContent ?? "", /当前账号不是管理员/);
  });
}

test("non-admin accounts can switch accounts but cannot access article management", async () => {
  let signOut = false;
  await mount({ ...guest, authenticated: true, userId: "reader" }, {
    page: "login", signOut: async () => { signOut = true; },
  });
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? "", /不是管理员/);
  assert.equal(host.querySelector("form")!.hidden, true);
  const switchAccount = [...host.querySelectorAll("button")].find(button => button.textContent === "退出当前账号")!;
  await act(async () => switchAccount.click());
  assert.equal(signOut, true);
  await act(async () => root!.unmount()); root = undefined; host.remove();
  const network = mock.method(globalThis, "fetch", async () => { throw new Error("Must not fetch admin data"); });
  await mount({ ...guest, authenticated: true, userId: "reader" }, { page: "articles", path: "/admin/articles" });
  assert.match(host.textContent ?? "", /无权限访问/);
  assert.equal(host.querySelector("form"), null);
  assert.equal(network.mock.callCount(), 0);
});

test("direct guest access to article management returns to login without fetching admin data", async () => {
  const network = mock.method(globalThis, "fetch", async () => { throw new Error("Must not fetch admin data"); });
  await mount(guest, { page: "articles", path: "/admin/articles" });
  assert.equal(host.querySelector("#location")?.textContent, "/admin/login?next=/admin/articles");
  assert.equal(host.querySelector("form"), null);
  assert.equal(network.mock.callCount(), 0);
});

test("shared provider updates all consumers together and clears them on logout", async () => {
  await loadUI();
  const client = repository.getSupabaseClient();
  mock.method(client.auth, "onAuthStateChange", (callback: typeof authCallback) => {
    authCallback = callback;
    return { data: { subscription: { unsubscribe() {} } } };
  });
  mock.method(client.auth, "getUser", async () => ({ data: { user: { id: "admin", app_metadata: { role: "admin" } } }, error: null }));
  function Probe({ id }: { id: string }) {
    const auth = authContext.useAdminAuth();
    return React.createElement("output", { id }, auth.checking ? "checking" : auth.isAdmin ? "admin" : "reader");
  }
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(React.createElement(authContext.AdminAuthProvider, null,
    React.createElement(Probe, { id: "nav-role" }), React.createElement(Probe, { id: "comment-role" }))));
  assert.equal(host.querySelector("#nav-role")?.textContent, "admin");
  assert.equal(host.querySelector("#comment-role")?.textContent, "admin");
  await act(async () => authCallback("SIGNED_OUT", null));
  assert.equal(host.querySelector("#nav-role")?.textContent, "reader");
  assert.equal(host.querySelector("#comment-role")?.textContent, "reader");
});
