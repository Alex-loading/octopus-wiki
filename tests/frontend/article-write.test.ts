import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveArticleCover,
  validateFeishuArticleInput,
  type FeishuArticleWriteInput,
} from "../../src/app/content/articleWrite.ts";

function validInput(overrides: Partial<FeishuArticleWriteInput> = {}): FeishuArticleWriteInput {
  return {
    title: "Article title",
    slug: "article-title",
    excerpt: "Summary",
    contentSnapshot: "# Article title\n\nContent",
    category: "技术",
    tags: ["Feishu"],
    coverImage: "",
    feishuDocUrl: "https://tenant.feishu.cn/docx/DocToken123",
    feishuRevisionId: "10",
    feishuSyncedAt: "2026-08-28T01:00:00.000Z",
    ...overrides,
  };
}

test("requires a Feishu link as the article body source", () => {
  assert.equal(
    validateFeishuArticleInput(validInput({ feishuDocUrl: "" })),
    "飞书文档链接不能为空。",
  );
});

test("requires a synchronized Feishu snapshot before saving", () => {
  assert.equal(
    validateFeishuArticleInput(validInput({ contentSnapshot: "" })),
    "请先读取飞书文档信息，再保存文章。",
  );
});

test("keeps summary and tags optional while requiring category", () => {
  assert.equal(validateFeishuArticleInput(validInput({ excerpt: "" })), null);
  assert.equal(validateFeishuArticleInput(validInput({ tags: [] })), null);
  assert.equal(validateFeishuArticleInput(validInput({ category: "" })), "分类不能为空。");
});

test("accepts a complete Feishu-backed article", () => {
  assert.equal(validateFeishuArticleInput(validInput()), null);
});

test("author signature and avatar are optional but validate supplied values", () => {
  assert.equal(validateFeishuArticleInput(validInput({ authorName: "", authorAvatar: "" })), null);
  assert.equal(validateFeishuArticleInput(validInput({ authorName: "摸鱼中的 Octopus", authorAvatar: "chill" })), null);
  assert.equal(validateFeishuArticleInput(validInput({ authorName: "章".repeat(41) })), "作者签名不能超过 40 个字符。");
  assert.equal(validateFeishuArticleInput(validInput({ authorAvatar: "https://example.com/avatar.svg" })), "请选择内置章鱼头像。");
});

test("resolves cover images in manual, Feishu, then fallback order", () => {
  assert.equal(resolveArticleCover(" https://example.com/manual.png ", "/api/feishu-media?first"), "https://example.com/manual.png");
  assert.equal(resolveArticleCover("", " /api/feishu-media?first "), "/api/feishu-media?first");
  assert.equal(resolveArticleCover("", ""), undefined);
});
