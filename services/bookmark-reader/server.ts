import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage } from "node:http";
import { BookmarkBrowserReader } from "./browser.ts";
import { BookmarkReaderError } from "./policy.ts";
import { previewErrorBody } from "../../src/app/content/bookmarkPreview.ts";

async function body(request: IncomingMessage): Promise<unknown> {
  if (request.headers["content-type"]?.split(";")[0].trim() !== "application/json")
    throw new BookmarkReaderError("INVALID_REQUEST", "请求必须使用 JSON。", 415);
  if (Number(request.headers["content-length"]) > 8192)
    throw new BookmarkReaderError("INVALID_REQUEST", "请求内容过长。", 413);
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 8192) throw new BookmarkReaderError("INVALID_REQUEST", "请求内容过长。", 413);
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch (error) {
    if (error instanceof SyntaxError)
      throw new BookmarkReaderError("INVALID_REQUEST", "JSON 请求格式错误。", 400);
    throw error;
  }
}

export function createReaderServer(reader: BookmarkBrowserReader, token: string) {
  const authorization = Buffer.from(`Bearer ${token}`);
  const server = createServer(async (request, response) => {
    const reply = (status: number, value: unknown) => {
      response.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
        ...(status === 413 ? { Connection: "close" } : {}),
      });
      response.end(JSON.stringify(value));
    };
    const supplied = Buffer.from(request.headers.authorization ?? "");
    if (supplied.length !== authorization.length || !timingSafeEqual(supplied, authorization))
      return reply(401, { success: false, code: "UNAUTHORIZED", message: "读取服务授权失败。" });
    if (request.method === "GET" && request.url === "/health")
      return reply(200, { success: true, data: reader.status() });
    if (request.method !== "POST" || !["/preview", "/login/start", "/login/check", "/login/cancel"].includes(request.url ?? ""))
      return reply(404, { success: false, code: "NOT_FOUND", message: "接口不存在。" });
    const controller = new AbortController();
    response.on("close", () => { if (!response.writableFinished) controller.abort(); });
    try {
      const input = await body(request);
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new BookmarkReaderError("INVALID_REQUEST", "请求格式错误。", 400);
      const payload = input as Record<string, unknown>;
      let data: unknown;
      if (request.url === "/preview" || request.url === "/login/start") {
        if (typeof payload.url !== "string")
          throw new BookmarkReaderError("INVALID_REQUEST", "请提供内容链接。", 400);
        if (request.url === "/preview") data = await reader.preview(payload.url, controller.signal);
        else {
          if (typeof payload.requestId !== "string")
            throw new BookmarkReaderError("INVALID_REQUEST", "登录请求标识无效。", 400);
          data = await reader.startLogin(payload.url, payload.requestId, controller.signal);
        }
      } else {
        if (typeof payload.sessionId !== "string" || payload.sessionId.length > 80)
          throw new BookmarkReaderError("INVALID_REQUEST", "登录会话标识无效。", 400);
        data = request.url === "/login/check"
          ? await reader.checkLogin(payload.sessionId, controller.signal)
          : await reader.cancelLogin(payload.sessionId);
      }
      if (!response.destroyed) reply(200, { success: true, data });
    } catch (error) {
      if (response.destroyed) return;
      if (error instanceof BookmarkReaderError)
        reply(error.status, previewErrorBody(error));
      else if (error instanceof Error && error.name === "AbortError")
        reply(409, { success: false, code: "READ_CANCELLED", message: "读取已取消。" });
      else if (error instanceof Error && error.name === "TargetCloseError")
        reply(409, { success: false, code: "READ_INTERRUPTED", message: "读取页面或浏览器已关闭，请重新读取。" });
      else if (error instanceof Error && error.name === "TimeoutError")
        reply(422, { success: false, code: "READ_TIMEOUT", message: "平台读取超时，请稍后重试。" });
      else {
        console.error("浏览器读取请求失败", error);
        reply(503, { success: false, code: "READER_FAILED", message: "浏览器读取服务执行失败，请检查服务日志。" });
      }
    }
  });
  server.requestTimeout = 40000;
  server.headersTimeout = 10000;
  return server;
}
