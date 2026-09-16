import type { Bookmark, validateBookmarkDraft } from "../src/app/content/bookmarks.ts";
import { readBoundedText } from "./_lib/bookmark-preview.ts";
import { createSupabaseGatewayFromEnv } from "./_lib/supabase.ts";
import { BookmarkSaveError, bookmarkServerClient, saveStoredBookmark, validateSaveInput } from "./_lib/bookmark-save.ts";

export function createBookmarksHandler(dependencies: {
  isAdmin: (token: string) => Promise<boolean>;
  save: (payload: ReturnType<typeof validateBookmarkDraft>, id?: string) => Promise<Bookmark>;
}) {
  return async (request: Request): Promise<Response> => {
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
    try {
      if (request.method !== "POST") return json({ success: false, message: "请使用 POST。" }, 405);
      const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
      if (!token || !(await dependencies.isAdmin(token))) return json({ success: false, message: "请先登录管理员账号。" }, 403);
      let body;
      try { body = JSON.parse(await readBoundedText(new Response(request.body), 32768)); }
      catch { throw new BookmarkSaveError("请求格式错误或内容过长。"); }
      if (!body || typeof body !== "object" || (body.id !== undefined &&
        (typeof body.id !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(body.id))))
        throw new BookmarkSaveError("收藏编号或请求格式错误。");
      const payload = validateSaveInput(body.draft);
      return json({ success: true, data: await dependencies.save(payload, body.id) });
    } catch (error) {
      return json({ success: false, message: error instanceof BookmarkSaveError ? error.message : "收藏服务暂时不可用。" },
        error instanceof BookmarkSaveError ? error.status : 503);
    }
  };
}

export const POST = createBookmarksHandler({
  isAdmin: token => createSupabaseGatewayFromEnv().isAdminAccessToken(token),
  save: (payload, id) => saveStoredBookmark(bookmarkServerClient(), payload, id),
});
