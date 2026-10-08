import { readerBaseUrl, readerToken } from "../../services/bookmark-reader/config.ts";
import { platformForUrl, readerUrl, validatePlatformPreview } from "../../services/bookmark-reader/policy.ts";
import {
  BookmarkPreviewError, previewResponseError, type BookmarkMetadata, type BookmarkReaderCommand,
  type BookmarkLoginSession, type BookmarkLoginResult,
} from "../../src/app/content/bookmarkPreview.ts";

async function requestReader(path: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  const endpoint = new URL(path, readerBaseUrl());
  const token = await readerToken();
  const response = await fetch(endpoint, {
    method: "POST", redirect: "error",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: AbortSignal.any([AbortSignal.timeout(40000), ...(signal ? [signal] : [])]),
  });
  const result = await response.json() as { success?: boolean; message?: string; data?: unknown };
  if (!response.ok || !result.success) throw previewResponseError(result, response.status);
  return result.data;
}

export async function readBookmarkPreview(value: string, signal?: AbortSignal): Promise<BookmarkMetadata> {
  const url = readerUrl(value);
  return validatePlatformPreview(await requestReader("/preview", { url: url.href }, signal), platformForUrl(url)!);
}

export async function bookmarkReaderCommand(command: BookmarkReaderCommand, signal?: AbortSignal)
  : Promise<BookmarkLoginSession | BookmarkLoginResult | void> {
  if (command.action === "login-start") {
    if (typeof command.url !== "string" || typeof command.requestId !== "string")
      throw new BookmarkPreviewError("INVALID_REQUEST", "登录请求格式错误。", 400);
    const url = readerUrl(command.url);
    return await requestReader("/login/start", { url: url.href, requestId: command.requestId }, signal) as BookmarkLoginSession;
  }
  if (!["login-check", "login-cancel"].includes(command.action) ||
      typeof command.sessionId !== "string" || command.sessionId.length > 80)
    throw new BookmarkPreviewError("INVALID_REQUEST", "登录请求格式错误。", 400);
  return await requestReader(command.action === "login-check" ? "/login/check" : "/login/cancel",
    { sessionId: command.sessionId }, signal) as BookmarkLoginResult | void;
}
