import { createSupabaseGatewayFromEnv } from "./_lib/supabase.ts";
import {
  fetchBookmarkPreview,
  readBoundedText,
} from "./_lib/bookmark-preview.ts";
import { bookmarkReaderCommand } from "./_lib/bookmark-browser-client.ts";
import { BookmarkPreviewError, previewErrorBody, type BookmarkReaderCommand } from "../src/app/content/bookmarkPreview.ts";

export function createBookmarkPreviewHandler(dependencies: {
  isAdmin: (token: string) => Promise<boolean>;
  preview: typeof fetchBookmarkPreview;
  readerCommand?: typeof bookmarkReaderCommand;
}) {
  return async (request: Request): Promise<Response> => {
    const json = (body: unknown, status = 200) =>
      Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    if (request.method !== "POST")
      return json({ success: false, message: "请使用 POST。" }, 405);
    const token = request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(\S+)$/i)?.[1];
    try {
      if (!token || !(await dependencies.isAdmin(token)))
        return json(
          { success: false, message: "仅管理员可以读取收藏预览。" },
          403,
        );
      let body: { action?: unknown; url?: unknown; requestId?: unknown; sessionId?: unknown };
      try {
        body = JSON.parse(
          await readBoundedText(new Response(request.body), 12000),
        );
      } catch {
        return json(
          { success: false, message: "链接请求格式错误或内容过长。" },
          400,
        );
      }
      if (body?.action !== undefined && !["preview", "login-start", "login-check", "login-cancel"].includes(String(body.action)))
        return json({ success: false, message: "请求操作无效。" }, 400);
      if ((!body?.action || body.action === "preview" || body.action === "login-start") &&
          (typeof body?.url !== "string" || !body.url || body.url.length > 4096))
        return json({ success: false, message: "请提供有效链接。" }, 400);
      try {
        return json({
          success: true,
          data: !body.action || body.action === "preview"
            ? await dependencies.preview(body.url as string, undefined, undefined, request.signal)
            : await (dependencies.readerCommand ?? bookmarkReaderCommand)(body as BookmarkReaderCommand, request.signal),
        });
      } catch (error) {
        if (error instanceof BookmarkPreviewError) return json(previewErrorBody(error), error.status);
        return json(
          {
            success: false,
            message:
              error instanceof Error && error.name !== "TimeoutError"
                ? error.message
                : "读取超时，可以手动填写后保存。",
          },
          422,
        );
      }
    } catch {
      return json(
        { success: false, message: "预览服务暂时不可用，可以手动填写后保存。" },
        503,
      );
    }
  };
}
export async function POST(request: Request): Promise<Response> {
  return createBookmarkPreviewHandler({
    isAdmin: (token) =>
      createSupabaseGatewayFromEnv().isAdminAccessToken(token),
    preview: fetchBookmarkPreview,
  })(request);
}
