import assert from "node:assert/strict";
import test from "node:test";

import { FeishuClient, FeishuError } from "../../api/_lib/feishu.ts";

type Call = { url: string; init?: RequestInit };

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("authenticates once, resolves Wiki, and paginates Docx blocks", async () => {
  const calls: Call[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init });

    if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
      return json({ code: 0, tenant_access_token: "tenant-token", expire: 7200 });
    }
    if (url.includes("/wiki/v2/spaces/get_node")) {
      return json({ code: 0, data: { node: { obj_type: "docx", obj_token: "doc-token" } } });
    }
    if (url.endsWith("/docx/v1/documents/doc-token")) {
      return json({ code: 0, data: { document: { title: "Test doc", revision_id: 42 } } });
    }
    if (url.includes("/documents/doc-token/blocks") && !url.includes("page_token=")) {
      return json({ code: 0, data: { items: [{ block_id: "root", block_type: 1 }], has_more: true, page_token: "next" } });
    }
    if (url.includes("page_token=next")) {
      return json({ code: 0, data: { items: [{ block_id: "paragraph", block_type: 2 }], has_more: false } });
    }
    throw new Error(`Unexpected URL: ${url}`);
  };

  const client = new FeishuClient({
    appId: "app-id",
    appSecret: "app-secret",
    fetchImpl,
    now: () => 1_000,
  });

  const first = await client.fetchDocument("https://tenant.feishu.cn/wiki/WikiToken123");
  const second = await client.fetchDocument("https://tenant.feishu.cn/docx/doc-token");

  assert.equal(first.docToken, "doc-token");
  assert.equal(first.title, "Test doc");
  assert.equal(first.revisionId, "42");
  assert.deepEqual(first.blocks.map((block) => block.block_id), ["root", "paragraph"]);
  assert.equal(second.docToken, "doc-token");
  assert.equal(calls.filter((call) => call.url.includes("tenant_access_token")).length, 1);
  assert.equal(calls.filter((call) => call.url.includes("get_node")).length, 1);
  assert.match(String(calls.find((call) => call.url.includes("/blocks"))?.url), /page_size=500/);
  assert.equal(
    new Headers(calls.find((call) => call.url.includes("get_node"))?.init?.headers).get("Authorization"),
    "Bearer tenant-token",
  );
});

test("maps Feishu API failures and rejects Wiki targets that are not Docx", async () => {
  const tokenResponse = json({ code: 0, tenant_access_token: "tenant-token", expire: 7200 });
  const fetchImpl = async (input: string | URL | Request): Promise<Response> => {
    const url = String(input);
    if (url.includes("tenant_access_token")) return tokenResponse.clone();
    return json({ code: 0, data: { node: { obj_type: "sheet", obj_token: "sheet-token" } } });
  };

  const client = new FeishuClient({ appId: "id", appSecret: "secret", fetchImpl });
  await assert.rejects(
    () => client.fetchDocument("https://tenant.feishu.cn/wiki/WikiToken123"),
    (error: unknown) => error instanceof FeishuError && error.code === "UNSUPPORTED_FEISHU_DOCUMENT",
  );

  const failingClient = new FeishuClient({
    appId: "id",
    appSecret: "secret",
    fetchImpl: async () => json({ code: 99991663, msg: "token invalid" }, 400),
  });
  await assert.rejects(
    () => failingClient.fetchDocument("https://tenant.feishu.cn/docx/DocToken123"),
    (error: unknown) => error instanceof FeishuError && error.code === "FEISHU_API_ERROR" && error.status === 502,
  );
});

test("downloads media with server-side authorization", async () => {
  const calls: Call[] = [];
  const fetchImpl = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("tenant_access_token")) {
      return json({ code: 0, tenant_access_token: "tenant-token", expire: 7200 });
    }
    return new Response("image-bytes", { headers: { "Content-Type": "image/png" } });
  };

  const client = new FeishuClient({ appId: "id", appSecret: "secret", fetchImpl });
  const response = await client.downloadMedia("media-token", "image");

  assert.equal(await response.text(), "image-bytes");
  assert.match(calls.at(-1)?.url ?? "", /drive\/v1\/medias\/media-token\/download$/);
  assert.equal(new Headers(calls.at(-1)?.init?.headers).get("Authorization"), "Bearer tenant-token");
});

test("never caches a tenant token beyond a short upstream lifetime", async () => {
  let now = 0;
  let tokenRequests = 0;
  const client = new FeishuClient({
    appId: "id",
    appSecret: "secret",
    now: () => now,
    fetchImpl: async (input) => {
      const url = String(input);
      if (url.includes("tenant_access_token")) {
        tokenRequests += 1;
        return json({ code: 0, tenant_access_token: `token-${tokenRequests}`, expire: 30 });
      }
      return new Response("bytes", { headers: { "Content-Type": "image/png" } });
    },
  });

  await client.downloadMedia("media-token", "image");
  now = 2_000;
  await client.downloadMedia("media-token", "image");
  assert.equal(tokenRequests, 2);
});
