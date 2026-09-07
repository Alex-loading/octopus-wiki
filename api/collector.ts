import { createHash, randomBytes } from "node:crypto";
import {
  validateBookmarkDraft,
  validateCollectionDraft,
  type BookmarkDraft,
  type CollectionDraft,
} from "../src/app/content/bookmarks.ts";
import {
  fetchBookmarkPreview,
  readBoundedText,
} from "./_lib/bookmark-preview.ts";
import {
  CollectorError,
  createCollectorGatewayFromEnv,
  type CollectorGateway,
} from "./_lib/collector-gateway.ts";

const COOKIE = "octopus_collector";
export const COLLECTOR_TTL = 90 * 24 * 60 * 60;
export const hashCollectorToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
function cookieToken(request: Request) {
  const value = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE}=`))
    ?.slice(COOKIE.length + 1);
  return value && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null;
}
function cookie(request: Request, token: string, maxAge: number) {
  return `${COOKIE}=${token}; Path=/api/collector; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}
function json(body: unknown, status = 200, setCookie?: string) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Cookie, Authorization",
      ...(setCookie ? { "Set-Cookie": setCookie } : {}),
    },
  });
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new CollectorError("请求格式错误。");
  return value as Record<string, unknown>;
}
function draft(value: unknown, strings: string[]) {
  const input = record(value);
  if (
    strings.some((key) => typeof input[key] !== "string") ||
    typeof input.is_public !== "boolean" ||
    "id" in input
  )
    throw new CollectorError("收藏内容格式错误，请检查输入。");
  return input;
}
export function createCollectorHandler(dependencies: {
  gateway: () => CollectorGateway;
  preview?: typeof fetchBookmarkPreview;
  now?: () => number;
}) {
  return async (request: Request): Promise<Response> => {
    try {
      if (!["GET", "POST"].includes(request.method))
        return json({ success: false, message: "请求方法不支持。" }, 405);
      const url = new URL(request.url);
      if (
        url.protocol !== "https:" &&
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )
        throw new CollectorError("免登录收藏需要通过 HTTPS 访问。", 403);
      // Bookmarklets navigate here; only the site's form can submit cookie-authorized writes.
      if (
        request.method === "POST" &&
        (request.headers.get("origin") !== url.origin ||
          request.headers.get("sec-fetch-site") === "cross-site")
      )
        throw new CollectorError("请在本站收藏页面提交请求。", 403);
      const token = cookieToken(request);
      if (request.method === "GET" && !token)
        return json({ success: true, data: { authorized: false } });
      const gateway = dependencies.gateway();
      const now = dependencies.now?.() ?? Date.now();
      const timestamp = new Date(now).toISOString();
      const hash = token ? hashCollectorToken(token) : null;
      const validDevice = async () => {
        const device = hash ? await gateway.findDevice(hash) : null;
        if (
          !device ||
          device.revoked_at ||
          !(Date.parse(device.expires_at) > now) ||
          !(await gateway.isOwnerAdmin(device.user_id))
        )
          return null;
        return device;
      };
      if (request.method === "GET") {
        const device = await validDevice();
        return json(
          {
            success: true,
            data: device
              ? {
                  authorized: true,
                  expiresAt: device.expires_at,
                  collections: await gateway.collections(),
                }
              : { authorized: false },
          },
          200,
          device ? undefined : cookie(request, "", 0),
        );
      }
      if (
        request.headers.get("content-type")?.split(";")[0].trim() !==
        "application/json"
      )
        throw new CollectorError("请求必须使用 JSON 格式。", 415);
      let body: Record<string, unknown>;
      try {
        body = record(
          JSON.parse(await readBoundedText(new Response(request.body), 32768)),
        );
      } catch {
        throw new CollectorError("请求格式错误或内容过长。");
      }
      if (body.action === "authorize" || body.action === "revoke-all") {
        const bearer = request.headers
          .get("authorization")
          ?.match(/^Bearer\s+(\S+)$/i)?.[1];
        const userId = bearer ? await gateway.adminId(bearer) : null;
        if (!userId)
          throw new CollectorError("请先登录管理员账号，再授权此设备。", 403);
        if (body.action === "revoke-all") {
          await gateway.revokeAll(userId, timestamp);
          return json(
            { success: true, data: { authorized: false } },
            200,
            cookie(request, "", 0),
          );
        }
        const newToken = randomBytes(32).toString("base64url");
        const expiresAt = new Date(now + COLLECTOR_TTL * 1000).toISOString();
        // Complete reads before minting so a failed response cannot silently create a device.
        const collections = await gateway.collections();
        if (hash) await gateway.revokeDevice(hash, timestamp);
        await gateway.addDevice({
          user_id: userId,
          token_hash: hashCollectorToken(newToken),
          expires_at: expiresAt,
          revoked_at: null,
        });
        return json(
          { success: true, data: { authorized: true, expiresAt, collections } },
          200,
          cookie(request, newToken, COLLECTOR_TTL),
        );
      }
      if (body.action === "revoke-current") {
        if (hash) await gateway.revokeDevice(hash, timestamp);
        return json(
          { success: true, data: { authorized: false } },
          200,
          cookie(request, "", 0),
        );
      }
      if (
        !["create-bookmark", "create-collection", "preview"].includes(
          String(body.action),
        )
      )
        throw new CollectorError(
          "此授权仅支持新增收藏、创建收藏箱和读取预览。",
          403,
        );
      if (!(await validDevice()))
        throw new CollectorError(
          "本设备的收藏授权已失效，请在新标签页打开快捷收藏设置，重新登录并启用后回到此页重试。",
          401,
        );
      let data: unknown;
      if (body.action === "preview") {
        if (typeof body.url !== "string" || body.url.length > 4096)
          throw new CollectorError("请提供有效链接。");
        try {
          data = await (dependencies.preview ?? fetchBookmarkPreview)(body.url);
        } catch (error) {
          throw new CollectorError(
            error instanceof Error
              ? error.message
              : "读取失败，可以手动填写后保存。",
            422,
          );
        }
      } else {
        let payload;
        try {
          payload =
            body.action === "create-bookmark"
              ? validateBookmarkDraft(
                  draft(body.draft, [
                    "collection_id",
                    "url",
                    "title",
                    "cover_url",
                    "note",
                  ]) as BookmarkDraft,
                )
              : validateCollectionDraft(
                  draft(body.draft, ["name", "description"]) as CollectionDraft,
                );
        } catch (error) {
          throw new CollectorError(
            error instanceof Error ? error.message : "请检查收藏内容。",
          );
        }
        data =
          body.action === "create-bookmark"
            ? await gateway.createBookmark(
                payload as ReturnType<typeof validateBookmarkDraft>,
              )
            : await gateway.createCollection(payload as CollectionDraft);
      }
      return json({ success: true, data });
    } catch (error) {
      return json(
        {
          success: false,
          message:
            error instanceof CollectorError
              ? error.message
              : "收藏服务暂时不可用，请稍后重试。",
        },
        error instanceof CollectorError ? error.status : 503,
      );
    }
  };
}
const handler = createCollectorHandler({
  gateway: createCollectorGatewayFromEnv,
});
export const GET = handler;
export const POST = handler;
