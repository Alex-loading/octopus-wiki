import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, afterEach, before, test } from "node:test";
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

let dom: JSDOM;
let root: Root;
let host: HTMLDivElement;
const originals = new Map<string, PropertyDescriptor | undefined>();

before(() => {
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost" });
  for (const [name, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  }
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  host?.remove();
});
after(() => {
  dom.window.close();
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
});

async function render(isAdmin: boolean, onDelete: () => Promise<void>) {
  const moduleUrl = new URL("../../src/app/components/CommentDeleteButton.tsx", import.meta.url);
  assert.equal(existsSync(moduleUrl), true, "comment deletion control should exist");
  const { CommentDeleteButton } = await import(moduleUrl.href);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(React.createElement(CommentDeleteButton, { isAdmin, darkMode: false, onDelete })));
}

test("does not expose deletion to ordinary readers", async () => {
  await render(false, async () => { assert.fail("reader must not delete"); });
  assert.equal(host.querySelector("button"), null);
});

test("cancelling the confirmation never calls deletion", async () => {
  let called = false;
  window.confirm = () => false;
  await render(true, async () => { called = true; });
  assert.match(host.textContent ?? "", /删除/);
  await act(async () => host.querySelector("button")!.click());
  assert.equal(called, false);
});

test("requires confirmation and disables repeated clicks while deleting", async () => {
  let resolve!: () => void;
  let calls = 0;
  window.confirm = (message) => { assert.match(message ?? "", /无法恢复/); return true; };
  await render(true, () => { calls++; return new Promise<void>((done) => { resolve = done; }); });
  await act(async () => host.querySelector("button")!.click());
  assert.equal(calls, 1);
  assert.equal(host.querySelector("button")!.disabled, true);
  assert.match(host.textContent ?? "", /删除中/);
  await act(async () => host.querySelector("button")!.click());
  assert.equal(calls, 1);
  await act(async () => resolve());
  assert.equal(host.querySelector("button")!.disabled, false);
});

test("shows deletion failures and permits retry", async () => {
  let calls = 0;
  window.confirm = () => true;
  await render(true, async () => { calls++; if (calls === 1) throw new Error("无权限执行该操作。"); });
  await act(async () => host.querySelector("button")!.click());
  assert.match(host.querySelector('[role="alert"]')?.textContent ?? "", /无权限/);
  assert.equal(host.querySelector("button")!.disabled, false);
  await act(async () => host.querySelector("button")!.click());
  assert.equal(calls, 2);
  assert.equal(host.querySelector('[role="alert"]'), null);
});
