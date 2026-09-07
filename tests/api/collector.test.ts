import assert from "node:assert/strict";
import test from "node:test";
import {
  COLLECTOR_TTL,
  createCollectorHandler,
  hashCollectorToken,
} from "../../api/collector.ts";
import {
  isCollectorAdmin,
  SupabaseCollectorGateway,
  type CaptureDevice,
  type CollectorGateway,
} from "../../api/_lib/collector-gateway.ts";

const origin = "https://wiki.example";
const box = {
  id: "10000000-0000-0000-0000-000000000001",
  name: "私密箱",
  description: "",
  is_public: false,
  sort_order: 0,
  created_at: "",
  updated_at: "",
};
const draft = {
  collection_id: box.id,
  title: "分享标题",
  url: "https://b23.tv/test?utm_source=share",
  cover_url: "",
  note: "保留",
  is_public: false,
};
function setup() {
  const devices = new Map<string, CaptureDevice>();
  let now = Date.parse("2026-09-07T00:00:00Z");
  let admin = true;
  const writes: any[] = [];
  let previews = 0;
  const gateway: CollectorGateway = {
    adminId: async (token) =>
      token === "verified-admin" && admin ? "owner" : null,
    isOwnerAdmin: async () => admin,
    findDevice: async (hash) => devices.get(hash) ?? null,
    addDevice: async (device) => {
      devices.set(device.token_hash, { ...device });
    },
    revokeDevice: async (hash, at) => {
      const device = devices.get(hash);
      if (device) device.revoked_at = at;
    },
    revokeAll: async (owner, at) => {
      for (const device of devices.values())
        if (device.user_id === owner) device.revoked_at = at;
    },
    collections: async () => [box],
    createBookmark: async (payload) => {
      writes.push(payload);
      return { id: "saved", created_at: "", updated_at: "", ...payload };
    },
    createCollection: async (payload) => {
      writes.push(payload);
      return { ...box, ...payload };
    },
  };
  const handler = createCollectorHandler({
    gateway: () => gateway,
    now: () => now,
    preview: async () => {
      previews++;
      return { title: "预览", cover_url: "" };
    },
  });
  const call = (
    body?: unknown,
    options: {
      cookie?: string;
      bearer?: string;
      origin?: string;
      method?: string;
    } = {},
  ) =>
    handler(
      new Request(`${origin}/api/collector`, {
        method: options.method ?? (body ? "POST" : "GET"),
        headers: {
          "Content-Type": "application/json",
          Origin: options.origin ?? origin,
          ...(options.cookie ? { Cookie: options.cookie } : {}),
          ...(options.bearer
            ? { Authorization: `Bearer ${options.bearer}` }
            : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }),
    );
  const authorize = async (previous?: string) => {
    const response = await call(
      { action: "authorize" },
      { bearer: "verified-admin", cookie: previous },
    );
    assert.equal(response.status, 200);
    return {
      response,
      cookie: response.headers.get("Set-Cookie")!.split(";")[0],
    };
  };
  return {
    gateway,
    devices,
    writes,
    handler,
    call,
    authorize,
    previews: () => previews,
    expire: () => {
      now += COLLECTOR_TTL * 1000;
    },
    demote: () => {
      admin = false;
    },
  };
}

test("only verified admins issue a persistent HttpOnly scoped cookie; plaintext is never stored or returned in JSON", async () => {
  const env = setup();
  for (const bearer of [undefined, "reader", "fake-admin"])
    assert.equal(
      (await env.call({ action: "authorize" }, { bearer })).status,
      403,
    );
  assert.equal(env.devices.size, 0);
  const { response, cookie } = await env.authorize();
  const header = response.headers.get("Set-Cookie")!;
  for (const part of [
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    "Path=/api/collector",
    `Max-Age=${COLLECTOR_TTL}`,
  ])
    assert.ok(header.includes(part), part);
  assert.ok(!header.includes("Domain="));
  const token = cookie.split("=")[1];
  assert.equal(token.length, 43);
  const stored = [...env.devices.values()][0];
  assert.equal(stored.token_hash, hashCollectorToken(token));
  assert.ok(!JSON.stringify(stored).includes(token));
  const body = await response.text();
  assert.ok(!body.includes(token));
  assert.ok(!body.includes(stored.token_hash));
  assert.equal(JSON.parse(body).data.expiresAt, "2026-12-06T00:00:00.000Z");
});
test("a new collector window without an admin JWT can list boxes, create a box, preview and save using its device cookie", async () => {
  const env = setup();
  const { cookie } = await env.authorize();
  const status = await env.call(undefined, { cookie });
  assert.deepEqual((await status.json()).data.collections, [box]);
  assert.equal(status.headers.get("Cache-Control"), "no-store");
  assert.match(status.headers.get("Vary")!, /Cookie/);
  assert.equal(
    (await env.call({ action: "preview", url: draft.url }, { cookie })).status,
    200,
  );
  assert.equal(env.previews(), 1);
  const create = await env.call(
    {
      action: "create-collection",
      draft: { name: "新箱", description: "", is_public: false, sort_order: 0 },
    },
    { cookie },
  );
  assert.equal(create.status, 200);
  const save = await env.call(
    {
      action: "create-bookmark",
      draft: {
        ...draft,
        canonical_url: "injected",
        platform: "injected",
        user_id: "attacker",
      },
    },
    { cookie },
  );
  assert.equal(save.status, 200);
  assert.equal(env.writes[1].canonical_url, "https://b23.tv/test");
  assert.equal(env.writes[1].platform, "bilibili");
  assert.ok(!("user_id" in env.writes[1]));
  assert.equal(env.writes[1].url, draft.url);
});
test("no cookie, tampered cookies, expiry and removed administrator roles block capture and never leak private boxes", async () => {
  for (const mode of ["missing", "tampered", "expired", "demoted"]) {
    const env = setup();
    const authorized = await env.authorize();
    const cookie =
      mode === "missing"
        ? undefined
        : mode === "tampered"
          ? `octopus_collector=${"a".repeat(43)}`
          : authorized.cookie;
    if (mode === "expired") env.expire();
    if (mode === "demoted") env.demote();
    const status = await env.call(undefined, { cookie });
    assert.deepEqual((await status.json()).data, { authorized: false }, mode);
    assert.equal(
      (await env.call({ action: "create-bookmark", draft }, { cookie })).status,
      401,
      mode,
    );
    assert.equal(env.writes.length, 0);
  }
});
test("current-device revocation needs no admin login and all-device revocation requires an admin", async () => {
  const env = setup();
  const first = await env.authorize();
  const second = await env.authorize();
  const revoked = await env.call(
    { action: "revoke-current" },
    { cookie: first.cookie },
  );
  assert.match(revoked.headers.get("Set-Cookie")!, /Max-Age=0/);
  assert.equal(
    (
      await env.call(
        { action: "create-bookmark", draft },
        { cookie: first.cookie },
      )
    ).status,
    401,
  );
  assert.equal(
    (await env.call(undefined, { cookie: second.cookie })).status,
    200,
  );
  assert.equal(
    (await env.call({ action: "revoke-all" }, { cookie: second.cookie }))
      .status,
    403,
  );
  const revokedAll = await env.call(
    { action: "revoke-all" },
    { bearer: "verified-admin" },
  );
  assert.equal(revokedAll.status, 200);
  assert.equal(
    (
      await env.call(
        { action: "create-bookmark", draft },
        { cookie: second.cookie },
      )
    ).status,
    401,
  );
});
test("renewal rotates the cookie and invalidates the previous secret", async () => {
  const env = setup();
  const first = await env.authorize();
  const second = await env.authorize(first.cookie);
  assert.notEqual(first.cookie, second.cookie);
  assert.equal(
    (
      await env.call(
        { action: "create-bookmark", draft },
        { cookie: first.cookie },
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await env.call(
        { action: "create-bookmark", draft },
        { cookie: second.cookie },
      )
    ).status,
    200,
  );
});
test("cross-site and missing-origin writes are rejected before authorization or mutations", async () => {
  const env = setup();
  const { cookie } = await env.authorize();
  for (const action of [
    "authorize",
    "revoke-current",
    "revoke-all",
    "create-bookmark",
    "create-collection",
    "preview",
  ]) {
    for (const wrongOrigin of ["https://evil.example", "null", ""]) {
      const response = await env.call(
        { action, draft, url: draft.url },
        { origin: wrongOrigin, cookie, bearer: "verified-admin" },
      );
      assert.equal(response.status, 403, `${action} ${wrongOrigin}`);
    }
  }
  assert.equal(env.devices.size, 1);
  assert.equal([...env.devices.values()][0].revoked_at, null);
  assert.equal(env.writes.length, 0);
  assert.equal(env.previews(), 0);
});
test("device authorization cannot edit/delete, mint authorization, submit malformed fields or choose unsafe URLs", async () => {
  const env = setup();
  const { cookie } = await env.authorize();
  for (const action of [
    "update-bookmark",
    "delete-bookmark",
    "delete-collection",
    "list-bookmarks",
    "authorize",
  ])
    assert.equal((await env.call({ action, draft }, { cookie })).status, 403);
  for (const input of [
    null,
    [],
    { ...draft, id: box.id },
    { ...draft, url: "javascript:alert(1)" },
    { ...draft, title: {} },
    { ...draft, is_public: "true" },
  ])
    assert.equal(
      (await env.call({ action: "create-bookmark", draft: input }, { cookie }))
        .status,
      400,
    );
  assert.equal(
    (
      await env.call(
        {
          action: "create-bookmark",
          draft: { ...draft, note: "x".repeat(33000) },
        },
        { cookie },
      )
    ).status,
    400,
  );
  assert.equal(
    (await env.call(undefined, { method: "DELETE", cookie })).status,
    405,
  );
  assert.equal(env.writes.length, 0);
});
test("service outages remain distinct from missing authorization and do not clear a valid cookie", async () => {
  const env = setup();
  const { cookie } = await env.authorize();
  env.gateway.isOwnerAdmin = async () => {
    throw new Error("private infrastructure details");
  };
  const response = await env.call(undefined, { cookie });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Set-Cookie"), null);
  assert.ok(!(await response.text()).includes("infrastructure"));
});
test("Supabase authority uses live app_metadata and rejects client-editable role claims", async () => {
  assert.equal(
    isCollectorAdmin({
      app_metadata: {},
      user_metadata: { role: "admin", is_admin: true },
    } as any),
    false,
  );
  for (const app_metadata of [
    { role: "admin" },
    { is_admin: true },
    { is_admin: "true" },
  ])
    assert.equal(isCollectorAdmin({ app_metadata } as any), true);
  let demoted = false;
  const queried: string[] = [];
  const gateway = new SupabaseCollectorGateway({
    auth: {
      admin: {
        getUserById: async (id: string) => {
          queried.push(id);
          return {
            data: { user: { app_metadata: demoted ? {} : { role: "admin" } } },
            error: null,
          };
        },
      },
    },
  } as any);
  assert.equal(await gateway.isOwnerAdmin("owner"), true);
  demoted = true;
  assert.equal(await gateway.isOwnerAdmin("owner"), false);
  assert.deepEqual(queried, ["owner", "owner"]);
});
