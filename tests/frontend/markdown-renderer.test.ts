import assert from "node:assert/strict";
import test from "node:test";

import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

type MarkdownRendererProps = {
  content: string;
  dm: boolean;
};

async function loadMarkdownRenderer(): Promise<ComponentType<MarkdownRendererProps>> {
  let module: Record<string, unknown>;
  try {
    module = await import("../../src/app/components/MarkdownRenderer.tsx") as Record<string, unknown>;
  } catch {
    assert.fail("MarkdownRenderer component module is missing");
  }
  assert.equal(
    typeof module.MarkdownRenderer,
    "function",
    "Post.tsx must export its Markdown renderer for behavior verification",
  );
  return module.MarkdownRenderer as ComponentType<MarkdownRendererProps>;
}

test("renders a sanitized Feishu callout with site-aligned colors and layout", async () => {
  const MarkdownRenderer = await loadMarkdownRenderer();
  const content = [
    '<div class="callout callout-bg-2 callout-border-2 untrusted" style="background: red">',
    '<div class="callout-emoji">💿</div>',
    '<p>UltraChat——一个SFT数据集</p>',
    '<p><a href="https://github.com/thunlp/UltraChat">项目地址</a></p>',
    '</div>',
  ].join("\n");

  const html = renderToStaticMarkup(createElement(MarkdownRenderer, { content, dm: false }));

  assert.match(html, /data-feishu-callout="true"/);
  assert.match(html, /background-color:#fff7ed/);
  assert.match(html, /border-color:#fed7aa/);
  assert.match(html, /feishu-callout-emoji/);
  assert.doesNotMatch(html, /row-span-\[20\]/);
  assert.doesNotMatch(html, /untrusted/);
  assert.doesNotMatch(html, /background:red/);
});

test("renders Markdown images as responsive lazy-loaded article media", async () => {
  const MarkdownRenderer = await loadMarkdownRenderer();
  const content = "![飞书图片](/api/feishu-media?token=image-token&type=image&sig=signature)";

  const html = renderToStaticMarkup(createElement(MarkdownRenderer, { content, dm: false }));

  assert.match(html, /data-article-image="true"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
  assert.match(html, /max-w-full/);
});
