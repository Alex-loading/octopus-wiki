import type { FeishuClient } from "./_lib/feishu.ts";
import { createFeishuClientFromEnv, FeishuError } from "./_lib/feishu.ts";
import { optimizeFeishuImage } from "./_lib/image-optimization.ts";
import {
  isFeishuMediaType,
  verifyMediaRequest,
} from "./_lib/media-signature.ts";

type MediaHandlerDependencies = {
  secret: string;
  client: Pick<FeishuClient, "downloadMedia">;
};

function jsonError(code: string, message: string, status: number): Response {
  return Response.json(
    { success: false, code, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function createFeishuMediaHandler(dependencies: MediaHandlerDependencies) {
  return async function mediaGET(request: Request): Promise<Response> {
    const params = new URL(request.url).searchParams;
    const token = params.get("token")?.trim() ?? "";
    const type = params.get("type")?.trim() ?? "";
    const signature = params.get("sig")?.trim() ?? "";
    const format = params.get("format");

    if (!isFeishuMediaType(type) || !verifyMediaRequest(token, type, signature, dependencies.secret)) {
      return jsonError("INVALID_MEDIA_SIGNATURE", "媒体链接无效或已被篡改。", 403);
    }

    if (format !== null && (format !== "webp-lossless-v1" || type === "file")) {
      return jsonError("INVALID_MEDIA_FORMAT", "不支持的图片转换格式。", 400);
    }

    try {
      const original = await dependencies.client.downloadMedia(token, type);
      const upstream = format === "webp-lossless-v1" ? await optimizeFeishuImage(original) : original;
      const headers = new Headers({
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/octet-stream",
      });
      for (const name of ["Content-Length", "ETag", "Last-Modified"]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
      }
      return new Response(upstream.body, { status: 200, headers });
    } catch (error) {
      if (error instanceof FeishuError) {
        return jsonError(error.code, error.message, error.status);
      }
      return jsonError("FEISHU_MEDIA_ERROR", "飞书媒体暂时不可用。", 502);
    }
  };
}

let runtimeHandler: ReturnType<typeof createFeishuMediaHandler> | null = null;

export async function GET(request: Request): Promise<Response> {
  try {
    if (!runtimeHandler) {
      const secret = process.env.FEISHU_MEDIA_SIGNING_SECRET ?? "";
      if (!secret) throw new Error("FEISHU_MEDIA_SIGNING_SECRET is required");
      runtimeHandler = createFeishuMediaHandler({
        secret,
        client: createFeishuClientFromEnv(),
      });
    }
    return await runtimeHandler(request);
  } catch {
    return jsonError("FEISHU_CONFIG_MISSING", "服务端飞书配置不完整。", 500);
  }
}
