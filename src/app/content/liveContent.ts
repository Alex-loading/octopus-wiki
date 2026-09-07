import type { Post } from "../data/posts";

export type FeishuPreview = {
  markdown: string;
  revisionId: string;
  title: string;
  coverImage: string | null;
};

type PublicLiveContent = {
  markdown: string;
  revisionId: string | null;
  syncedAt: string | null;
  stale: boolean;
  source: "live" | "snapshot";
};

type ApiEnvelope<T> =
  | { success: true; data: T }
  | { success: false; code?: string; message?: string };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function readApiResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;
  if (!response.ok || !body || body.success !== true) {
    const error = body && body.success === false ? body : null;
    const message = error?.message ?? "飞书内容接口响应异常。";
    throw new Error(error?.code ? `${error.code}: ${message}` : message);
  }
  return body.data;
}

export async function fetchLiveArticleContent(
  snapshot: Post,
  fetchImpl: FetchLike = fetch,
): Promise<Post> {
  if (!snapshot.feishuDocUrl) return snapshot;
  const response = await fetchImpl(`/api/feishu-content?slug=${encodeURIComponent(snapshot.slug)}`);
  const data = await readApiResponse<PublicLiveContent>(response);
  return {
    ...snapshot,
    content: data.markdown,
    feishuRevisionId: data.revisionId ?? undefined,
    feishuSyncedAt: data.syncedAt ?? undefined,
  };
}

export async function previewFeishuDocument(
  docUrl: string,
  accessToken: string,
  fetchImpl: FetchLike = fetch,
): Promise<FeishuPreview> {
  const response = await fetchImpl("/api/feishu-content", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ docUrl: docUrl.trim() }),
  });
  return readApiResponse<FeishuPreview>(response);
}
