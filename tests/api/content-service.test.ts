import assert from "node:assert/strict";
import test from "node:test";

import {
  ContentServiceError,
  getPublicArticleContent,
  previewFeishuContent,
  type ArticleContentGateway,
} from "../../api/_lib/content-service.ts";

function gateway(overrides: Partial<ArticleContentGateway> = {}): ArticleContentGateway {
  return {
    findPublishedArticleBySlug: async () => ({
      id: "article-id",
      slug: "hello",
      content: "snapshot markdown",
      feishuDocUrl: "https://tenant.feishu.cn/docx/DocToken123",
      feishuRevisionId: "old",
      feishuSyncedAt: "2026-08-27T00:00:00.000Z",
    }),
    updateArticleSnapshot: async () => undefined,
    isAdminAccessToken: async () => true,
    ...overrides,
  };
}

test("returns live Markdown and persists a fresh snapshot", async () => {
  const updates: unknown[] = [];
  const result = await getPublicArticleContent("hello", {
    gateway: gateway({ updateArticleSnapshot: async (_id, update) => { updates.push(update); } }),
    fetchMarkdown: async () => ({ markdown: "live markdown", revisionId: "new", title: "Live", coverImage: null }),
    now: () => new Date("2026-08-28T01:02:03.000Z"),
  });

  assert.deepEqual(result, {
    markdown: "live markdown",
    revisionId: "new",
    syncedAt: "2026-08-28T01:02:03.000Z",
    stale: false,
    source: "live",
  });
  assert.deepEqual(updates, [{
    content: "live markdown",
    revisionId: "new",
    syncedAt: "2026-08-28T01:02:03.000Z",
  }]);
});

test("returns the snapshot when Feishu fails and errors only when no snapshot exists", async () => {
  const result = await getPublicArticleContent("hello", {
    gateway: gateway(),
    fetchMarkdown: async () => { throw new Error("upstream offline"); },
  });
  assert.equal(result.markdown, "snapshot markdown");
  assert.equal(result.stale, true);
  assert.equal(result.source, "snapshot");

  await assert.rejects(
    () => getPublicArticleContent("hello", {
      gateway: gateway({
        findPublishedArticleBySlug: async () => ({
          id: "empty",
          slug: "empty",
          content: "",
          feishuDocUrl: "https://tenant.feishu.cn/docx/DocToken123",
          feishuRevisionId: null,
          feishuSyncedAt: null,
        }),
      }),
      fetchMarkdown: async () => { throw new Error("upstream offline"); },
    }),
    (error: unknown) => error instanceof ContentServiceError && error.code === "FEISHU_CONTENT_UNAVAILABLE",
  );
});

test("does not contact Feishu for ordinary snapshot articles", async () => {
  let fetchCount = 0;
  const result = await getPublicArticleContent("hello", {
    gateway: gateway({
      findPublishedArticleBySlug: async () => ({
        id: "article-id",
        slug: "hello",
        content: "ordinary markdown",
        feishuDocUrl: null,
        feishuRevisionId: null,
        feishuSyncedAt: null,
      }),
    }),
    fetchMarkdown: async () => {
      fetchCount += 1;
      return { markdown: "unexpected", revisionId: "1", title: "Unexpected", coverImage: null };
    },
  });
  assert.equal(fetchCount, 0);
  assert.equal(result.markdown, "ordinary markdown");
  assert.equal(result.stale, false);
  assert.equal(result.source, "snapshot");
});

test("checks admin authorization before previewing a document", async () => {
  let fetchCount = 0;
  await assert.rejects(
    () => previewFeishuContent("access-token", "https://tenant.feishu.cn/docx/DocToken123", {
      gateway: gateway({ isAdminAccessToken: async () => false }),
      fetchMarkdown: async () => {
        fetchCount += 1;
        return { markdown: "content", revisionId: "1", title: "Title", coverImage: null };
      },
    }),
    (error: unknown) => error instanceof ContentServiceError && error.code === "ADMIN_REQUIRED",
  );
  assert.equal(fetchCount, 0);
});
