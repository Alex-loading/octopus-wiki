import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { JSDOM } from "jsdom";

import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { convertFeishuDocumentToMarkdown } from "../../api/_lib/markdown.ts";
import type { FeishuDocument } from "../../api/_lib/feishu.ts";

type MarkdownRendererProps = {
  content: string;
  dm: boolean;
};

let server: ViteDevServer;
const cacheRoot = resolve(".debug");
mkdirSync(cacheRoot, { recursive: true });
const cacheDir = mkdtempSync(join(cacheRoot, "octopus-markdown-test-"));
before(async () => {
  server = await createServer({
    configFile: false,
    envFile: false,
    cacheDir,
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    esbuild: { jsx: "automatic" },
    ssr: { noExternal: ["react-syntax-highlighter"] },
  });
});
after(async () => {
  await server.close();
  rmSync(cacheDir, { recursive: true, force: true });
});

async function loadMarkdownRenderer(): Promise<ComponentType<MarkdownRendererProps>> {
  // 使用应用的 module loader 加载面向 bundler 的 ESM 依赖。
  const module = await server.ssrLoadModule("/src/app/components/MarkdownRenderer.tsx");
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

test("飞书文章中的嵌套代码完整显示并保留后续列表", async () => {
  const MarkdownRenderer = await loadMarkdownRenderer();
  const source: FeishuDocument = JSON.parse(
    readFileSync(new URL("../fixtures/feishu-langchain-code.json", import.meta.url), "utf8"),
  );
  const { markdown: content } = convertFeishuDocumentToMarkdown(source, "signing-secret");
  const html = renderToStaticMarkup(createElement(MarkdownRenderer, { content, dm: false }));
  const document = new JSDOM(html).window.document;
  const renderedCode = [...document.querySelectorAll(".group code")];
  const originalCode = source.blocks.filter((block) => block.block_type === 14).map((block) => {
    const code = block.code as { elements: { text_run: { content: string } }[] };
    return code.elements.map((element) => element.text_run.content).join("");
  });

  assert.deepEqual(renderedCode.map((element) => element.textContent), originalCode);
  assert.equal(document.querySelectorAll('button[aria-label="复制代码"]').length, 2);
  assert.ok([...document.querySelectorAll("li")]
    .some((element) => element.textContent === "参数需要提供类型提示"));
});

test("飞书代码块默认收起，标题显示语言并允许分别展开和收起", async () => {
  const MarkdownRenderer = await loadMarkdownRenderer();
  const source: FeishuDocument = JSON.parse(
    readFileSync(new URL("../fixtures/feishu-langchain-code.json", import.meta.url), "utf8"),
  );
  const { markdown: content } = convertFeishuDocumentToMarkdown(source, "signing-secret");
  const document = new JSDOM(renderToStaticMarkup(
    createElement(MarkdownRenderer, { content, dm: false }),
  )).window.document;
  const blocks = [...document.querySelectorAll("details[data-article-code-block]")];

  assert.equal(blocks.length, 2);
  for (const block of blocks) {
    assert.equal(block.hasAttribute("open"), false);
    assert.equal(block.querySelector("[data-code-language]")?.textContent, "Python");
    assert.ok(block.querySelector("summary"));
  }

  const firstSummary = blocks[0].querySelector("summary")!;
  firstSummary.click();
  assert.equal(blocks[0].hasAttribute("open"), true);
  assert.equal(blocks[1].hasAttribute("open"), false);
  firstSummary.click();
  assert.equal(blocks[0].hasAttribute("open"), false);
});

test("无语言的单行代码块可以收起，行内代码保持行内显示", async () => {
  const MarkdownRenderer = await loadMarkdownRenderer();
  const content = "正文中的 `provider:model`。\n\n```\ncreate_agent()\n```";
  const document = new JSDOM(renderToStaticMarkup(
    createElement(MarkdownRenderer, { content, dm: true }),
  )).window.document;
  const block = document.querySelector("details[data-article-code-block]");

  assert.ok(block);
  assert.equal(block.hasAttribute("open"), false);
  assert.equal(block.querySelector("[data-code-language]")?.textContent, "纯文本");
  assert.equal(block.querySelector("[data-code-label]")?.textContent, "代码块");
  assert.equal(block.querySelector("code")?.textContent, "create_agent()");
  assert.equal(document.querySelector("p code")?.textContent, "provider:model");
  assert.equal(document.querySelectorAll("details").length, 1);
  assert.equal(document.querySelectorAll('button[aria-label="复制代码"]').length, 1);
});

test("语言标签保留完整名称并兼容 Markdown 语言别名", async () => {
  const MarkdownRenderer = await loadMarkdownRenderer();
  const content = [
    "```js", "const ready = true;", "```", "",
    "```c++", "int main() {}", "```", "",
    "```custom-language", "custom code", "```",
  ].join("\n");
  const document = new JSDOM(renderToStaticMarkup(
    createElement(MarkdownRenderer, { content, dm: false }),
  )).window.document;

  assert.deepEqual(
    [...document.querySelectorAll("[data-code-language]")].map((element) => element.textContent),
    ["JavaScript", "C++", "custom-language"],
  );
});

test("飞书代码说明显示在收起状态的标题中，代码正文只包含源代码", async () => {
  const MarkdownRenderer = await loadMarkdownRenderer();
  const source: FeishuDocument = JSON.parse(
    readFileSync(new URL("../fixtures/feishu-langchain-code-caption.json", import.meta.url), "utf8"),
  );
  const { markdown: content } = convertFeishuDocumentToMarkdown(source, "signing-secret");
  const document = new JSDOM(renderToStaticMarkup(
    createElement(MarkdownRenderer, { content, dm: false }),
  )).window.document;
  const block = document.querySelector("details[data-article-code-block]")!;

  assert.equal(block.hasAttribute("open"), false);
  assert.equal(block.querySelector("summary [data-code-caption]")?.textContent, "接受初始化的模型实例");
  assert.equal(block.querySelector("[data-code-label]")?.getAttribute("title"), "接受初始化的模型实例");
  assert.equal(block.querySelector("[data-code-language]")?.textContent, "Python");
  assert.doesNotMatch(block.querySelector("code")?.textContent ?? "", /接受初始化的模型实例/);
});

test("代码说明保留 backticks、换行和 HTML 字符，完整代码仍然可以展开", async () => {
  const MarkdownRenderer = await loadMarkdownRenderer();
  const source: FeishuDocument = JSON.parse(
    readFileSync(new URL("../fixtures/feishu-langchain-code-caption.json", import.meta.url), "utf8"),
  );
  const caption = "接受 `ChatDeepSeek` 实例\n验证 <span>参数</span>";
  const { markdown: content } = convertFeishuDocumentToMarkdown({
    ...source,
    rawContent: source.rawContent!.replace("接受初始化的模型实例\n", `${caption}\n`),
  }, "signing-secret");
  const document = new JSDOM(renderToStaticMarkup(
    createElement(MarkdownRenderer, { content, dm: false }),
  )).window.document;

  assert.equal(document.querySelector("[data-code-caption]")?.textContent, caption);
  assert.equal(document.querySelector("[data-code-caption] span"), null);
  assert.equal(document.querySelectorAll("details[data-article-code-block]").length, 1);
  const code = source.blocks.find((block) => block.block_type === 14)!.code as {
    elements: { text_run: { content: string } }[];
  };
  assert.equal(document.querySelector("details code")?.textContent,
    code.elements.map((element) => element.text_run.content).join(""));
});
