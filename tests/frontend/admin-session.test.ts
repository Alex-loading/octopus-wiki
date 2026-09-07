import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

async function helpers() {
  const url = new URL("../../src/app/auth/adminSession.ts", import.meta.url);
  assert.equal(existsSync(url), true, "shared admin session helpers should exist");
  return import(url.href);
}

test("login gesture requires five clicks within a rolling two-second window and resets after triggering", async () => {
  const { createAdminLoginGesture } = await helpers();
  const click = createAdminLoginGesture();
  assert.deepEqual([0, 400, 800, 1200, 1999].map(click), [false, false, false, false, true]);
  assert.equal(click(2000), false);
  const slow = createAdminLoginGesture();
  assert.deepEqual([0, 700, 1400, 2100, 2800].map(slow), [false, false, false, false, false]);
  assert.equal(slow(2900), false);
  assert.equal(slow(3000), true);
});

test("return paths preserve article anchors but reject external URLs and login loops", async () => {
  const { safeAdminReturnPath } = await helpers();
  for (const path of ["/", "/blog", "/lab", "/about", "/admin/articles", "/post/example?preview=1#section"]) {
    assert.equal(safeAdminReturnPath(path), path);
  }
  for (const path of [null, "", "https://evil.example", "//evil.example", "/\\evil.example", "/\nevil", "/admin/login", "/admin/login?next=/", "/unknown", "javascript:alert(1)"]) {
    assert.equal(safeAdminReturnPath(path), "/admin/articles");
  }
});

test("tab storage survives a recreated client and clears only its own keys", async () => {
  const { createTabSessionStorage } = await helpers();
  const values = new Map<string, string>([["unrelated", "keep"]]);
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
  const first = createTabSessionStorage(() => storage);
  first.setItem("test-auth", "test-session");
  const reloaded = createTabSessionStorage(() => storage);
  assert.equal(reloaded.getItem("test-auth"), "test-session");
  reloaded.removeItem("test-auth");
  assert.equal(first.getItem("test-auth"), null);
  assert.equal(values.get("unrelated"), "keep");
});

test("blocked sessionStorage falls back to ephemeral memory without crashing", async () => {
  const { createTabSessionStorage } = await helpers();
  const storage = createTabSessionStorage(() => { throw new Error("storage blocked"); });
  storage.setItem("test", "value");
  assert.equal(storage.getItem("test"), "value");
  storage.removeItem("test");
  assert.equal(storage.getItem("test"), null);
  assert.equal(createTabSessionStorage(() => undefined).getItem("test"), null);
});

test("late role lookups cannot restore administrator state after signout", async () => {
  const { watchAdminRole } = await helpers();
  let callback!: (event: string, session: unknown) => void;
  let resolve!: (role: unknown) => void;
  let unsubscribed = false;
  const states: any[] = [];
  const stop = watchAdminRole({
    onAuthStateChange: (fn: typeof callback) => {
      callback = fn;
      return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
    },
  }, () => new Promise(done => { resolve = done; }), (state: unknown) => states.push(state));
  assert.equal(states.at(-1).checking, true);
  callback("SIGNED_OUT", null);
  assert.equal(states.at(-1).isAdmin, false);
  resolve({ authenticated: true, isAdmin: true, userId: "admin" });
  await Promise.resolve();
  assert.equal(states.at(-1).isAdmin, false);
  assert.equal(states.at(-1).checking, false);
  stop();
  assert.equal(unsubscribed, true);
});

test("role subscription defers auth calls and fails closed on errors", async () => {
  const { watchAdminRole } = await helpers();
  let callback!: (event: string, session: unknown) => void;
  let calls = 0;
  const states: any[] = [];
  const stop = watchAdminRole({
    onAuthStateChange: (fn: typeof callback) => { callback = fn; return { data: { subscription: { unsubscribe() {} } } }; },
  }, async () => { calls++; throw new Error("offline"); }, (state: unknown) => states.push(state));
  await Promise.resolve();
  assert.equal(states.at(-1).isAdmin, false);
  const previousCalls = calls;
  callback("SIGNED_IN", { user: { id: "reader" } });
  assert.equal(calls, previousCalls, "Auth APIs must not run within the callback lock");
  await new Promise(done => setTimeout(done, 10));
  assert.equal(calls, previousCalls + 1);
  assert.equal(states.at(-1).checking, false);
  assert.equal(states.at(-1).isAdmin, false);
  stop();
});
