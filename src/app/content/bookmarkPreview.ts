import type { BookmarkPlatform } from "./bookmarks.ts";

export type BookmarkMetadata = { title: string; cover_url: string };
export type ReaderInteraction = { mode: "local" | "remote"; url?: string };
export type BookmarkLoginSession = {
  id: string;
  platform: BookmarkPlatform;
  expiresAt: number;
  interaction: ReaderInteraction;
};
export type BookmarkLoginResult =
  | { status: "pending" }
  | { status: "ready"; metadata: BookmarkMetadata };
export type BookmarkReaderCommand =
  | { action: "login-start"; url: string; requestId: string }
  | { action: "login-check" | "login-cancel"; sessionId: string };

export class BookmarkPreviewError extends Error {
  readonly code: string;
  readonly status: number;
  readonly platform?: BookmarkPlatform;
  readonly interaction?: ReaderInteraction;

  constructor(code: string, message: string, status = 422,
    platform?: BookmarkPlatform, interaction?: ReaderInteraction) {
    super(message);
    this.name = "BookmarkPreviewError";
    this.code = code;
    this.status = status;
    this.platform = platform;
    this.interaction = interaction;
  }
}

export function needsBookmarkInteraction(error: unknown): error is BookmarkPreviewError {
  return error instanceof BookmarkPreviewError &&
    ["LOGIN_REQUIRED", "VERIFICATION_REQUIRED", "METADATA_MISSING", "ACCESS_DENIED"].includes(error.code);
}

export function previewErrorBody(error: BookmarkPreviewError) {
  return { success: false, code: error.code, message: error.message,
    platform: error.platform, interaction: error.interaction };
}

export function previewResponseError(value: unknown, status: number): BookmarkPreviewError {
  const result = value as Partial<ReturnType<typeof previewErrorBody>> | null;
  return new BookmarkPreviewError(
    typeof result?.code === "string" ? result.code : "PREVIEW_FAILED",
    typeof result?.message === "string" ? result.message : "内容读取失败，请稍后重试。",
    status, result?.platform, result?.interaction,
  );
}

export type BookmarkPreviewActions = {
  preview: (url: string, signal?: AbortSignal) => Promise<BookmarkMetadata>;
  startLogin: (url: string, requestId: string, signal?: AbortSignal) => Promise<BookmarkLoginSession>;
  checkLogin: (sessionId: string, signal?: AbortSignal) => Promise<BookmarkLoginResult>;
  cancelLogin: (sessionId: string) => Promise<void>;
};
