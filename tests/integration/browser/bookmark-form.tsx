import React from "react";
import { createRoot } from "react-dom/client";
import { BookmarkForm } from "../../../src/app/components/BookmarkForm";
import { emptyBookmark } from "../../../src/app/content/bookmarks";
import { saveBookmark, saveBookmarkCollection } from "../../../src/app/content/bookmarkRepository";
import { previewResponseError, type BookmarkMetadata, type BookmarkLoginSession,
  type BookmarkLoginResult } from "../../../src/app/content/bookmarkPreview";

async function request<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/reader${path}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw previewResponseError(result, response.status);
  return result.data;
}

const root = createRoot(document.getElementById("root")!);
root.render(<BookmarkForm collections={[]} initial={{ ...emptyBookmark(), url: "https://xhslink.cn/o/isOHHGiso1" }}
  onCollectionCreated={() => {}} onSaved={() => {}} onCancel={() => root.unmount()}
  actions={{
    save: saveBookmark, createCollection: saveBookmarkCollection,
    preview: (url, signal) => request<BookmarkMetadata>("/preview", { url }, signal),
    startLogin: (url, requestId, signal) => request<BookmarkLoginSession>("/login/start", { url, requestId }, signal),
    checkLogin: (sessionId, signal) => request<BookmarkLoginResult>("/login/check", { sessionId }, signal),
    cancelLogin: sessionId => request<void>("/login/cancel", { sessionId }),
  }} />);
