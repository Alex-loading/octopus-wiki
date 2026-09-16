import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "vite";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localApi } from "../../scripts/vite-api.ts";

test("new API files are available without restarting and POST bodies and multiple cookies survive the adapter", async () => {
  const root = mkdtempSync(join(tmpdir(), "wiki-local-api-"));
  mkdirSync(join(root, "api"));
  const server = await createServer({ root, configFile: false, plugins: [localApi()],
    server: { host: "127.0.0.1", port: 0, hmr: false }, optimizeDeps: { noDiscovery: true }, logLevel: "error" });
  try {
    await server.listen();
    const base = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`;
    assert.equal((await fetch(`${base}/api/echo`)).status, 404);
    writeFileSync(join(root, "api/echo.ts"), `export async function POST(request: Request) {
      const headers = new Headers({ "Content-Type": "application/json" });
      headers.append("Set-Cookie", "one=1; HttpOnly"); headers.append("Set-Cookie", "two=2; HttpOnly");
      return new Response(await request.text(), { status: 201, headers });
    }`);
    const response = await fetch(`${base}/api/echo`, { method: "POST", body: '{"saved":true}' });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { saved: true });
    assert.equal(response.headers.getSetCookie().length, 2);
  } finally { await server.close(); rmSync(root, { recursive: true, force: true }); }
});

test("local dev executes APIs, streams responses and hides server source", async () => {
  process.env.FEISHU_MEDIA_SIGNING_SECRET = "test-secret";
  process.env.FEISHU_APP_ID = "test-app";
  process.env.FEISHU_APP_SECRET = "test-app-secret";
  const server = await createServer({ server: { host: "127.0.0.1", port: 0, hmr: false }, logLevel: "error" });
  try {
    await server.listen();
    const address = server.httpServer!.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    const media = await fetch(`${base}/api/feishu-media?token=test-token&type=image&sig=bad`);
    assert.equal(media.status, 403);
    assert.equal((await media.json()).code, "INVALID_MEDIA_SIGNATURE");
    const collector = await fetch(`${base}/api/collector`);
    assert.deepEqual(await collector.json(), { success: true, data: { authorized: false } });
    assert.equal((await fetch(`${base}/api/feishu-media`, { method: "DELETE" })).status, 405);
    for (const path of ["/api/_lib/feishu.ts", "/api/feishu-media.ts", "/api/missing"])
      assert.equal((await fetch(base + path)).status, 404);
  } finally { await server.close(); }
});
