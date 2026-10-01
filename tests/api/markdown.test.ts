import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { MarkdownRenderer } from "feishu-docx";
import { JSDOM } from "jsdom";

import { convertFeishuDocumentToMarkdown } from "../../api/_lib/markdown.ts";
import type { FeishuDocument } from "../../api/_lib/feishu.ts";

const langchainDocument: FeishuDocument = JSON.parse(
  readFileSync(new URL("../fixtures/feishu-langchain-code.json", import.meta.url), "utf8"),
);

const captionDocument: FeishuDocument = JSON.parse(
  readFileSync(new URL("../fixtures/feishu-langchain-code-caption.json", import.meta.url), "utf8"),
);

test("通过飞书纯文本读取代码说明，同时完整保留代码正文", () => {
  const { markdown } = convertFeishuDocumentToMarkdown(captionDocument, "signing-secret");
  assert.match(markdown, /```py feishu-caption="接受初始化的模型实例"/);
  const renderer = new MarkdownRenderer({});
  const document = new JSDOM(renderer.markdownToHTML(markdown)).window.document;
  const source = captionDocument.blocks.find((block) => block.block_type === 14)!;
  const code = source.code as { elements: { text_run: { content: string } }[] };
  assert.equal(document.querySelector("pre > code")?.textContent,
    `${code.elements.map((element) => element.text_run.content).join("")}\n`);
});

test("缺少代码说明时保留普通段落，不使用前文作为代码标题", () => {
  const rawContent = captionDocument.rawContent!.replace("接受初始化的模型实例\n", "");
  const { markdown } = convertFeishuDocumentToMarkdown({ ...captionDocument, rawContent }, "signing-secret");
  assert.doesNotMatch(markdown, /feishu-caption=/);
  assert.match(markdown, /Model：模型，接受一个/);
});

test("代码正文在纯文本中重复时不关联无法确定归属的说明", () => {
  const { markdown } = convertFeishuDocumentToMarkdown({
    ...captionDocument,
    rawContent: `${captionDocument.rawContent}\n${captionDocument.rawContent}`,
  }, "signing-secret");
  assert.doesNotMatch(markdown, /feishu-caption=/);
});

function renderLangchainDocument(): Document {
  const converted = convertFeishuDocumentToMarkdown(langchainDocument, "signing-secret");
  const renderer = new MarkdownRenderer({});
  return new JSDOM(renderer.markdownToHTML(converted.markdown)).window.document;
}

function originalCode(blockId: string): string {
  const block = langchainDocument.blocks.find((item) => item.block_id === blockId);
  assert.ok(block);
  const code = block.code as { elements: { text_run: { content: string } }[] };
  return code.elements.map((element) => element.text_run.content).join("");
}

test("多层列表中的代码块保留完整代码及函数缩进", () => {
  const document = renderLangchainDocument();
  const code = [...document.querySelectorAll("pre > code")]
    .find((element) => element.textContent?.includes("StateBackend"));

  assert.ok(code);
  assert.equal(code.className, "language-py");
  assert.equal(code.textContent, `${originalCode("Yh4fdDqzuoiSzfxnGCScGebknDh")}\n`);
  assert.match(code.closest("li")?.textContent ?? "", /Context management/);
});

test("装饰器代码中的空行和 Args 内容保留在同一个代码块", () => {
  const document = renderLangchainDocument();
  const code = [...document.querySelectorAll("pre > code")]
    .find((element) => element.textContent?.includes("search_database"));

  assert.ok(code);
  assert.equal(code.textContent, `${originalCode("NcTcdudeaoVIzCxAuu5cuOH5nOh")}\n`);
  assert.equal(document.querySelectorAll("pre").length, 2);
  assert.ok([...document.querySelectorAll("li")]
    .some((element) => element.textContent === "参数需要提供类型提示"));
});

const blocks = [
  {
    block_id: "doc-token",
    block_type: 1,
    children: ["heading", "paragraph", "image", "file", "unsupported"],
    page: {
      style: {},
      elements: [{ text_run: { content: "Demo document", text_element_style: {} } }],
    },
  },
  {
    block_id: "heading",
    parent_id: "doc-token",
    block_type: 4,
    heading2: {
      style: {},
      elements: [{ text_run: { content: "Section", text_element_style: {} } }],
    },
  },
  {
    block_id: "paragraph",
    parent_id: "doc-token",
    block_type: 2,
    text: {
      style: {},
      elements: [
        { text_run: { content: "Bold", text_element_style: { bold: true } } },
        { text_run: { content: " text", text_element_style: {} } },
      ],
    },
  },
  {
    block_id: "image",
    parent_id: "doc-token",
    block_type: 27,
    image: { token: "image-token", width: 640, height: 480 },
  },
  {
    block_id: "file",
    parent_id: "doc-token",
    block_type: 23,
    file: { token: "file-token", name: "attachment.pdf" },
  },
  {
    block_id: "unsupported",
    parent_id: "doc-token",
    block_type: 18,
    bitable: {},
  },
];

test("renders Feishu blocks and rewrites media tokens to signed proxy URLs", () => {
  const result = convertFeishuDocumentToMarkdown(
    { docToken: "doc-token", title: "Demo document", revisionId: "7", blocks },
    "signing-secret",
  );

  assert.match(result.markdown, /^# Demo document/m);
  assert.match(result.markdown, /^## Section/m);
  assert.match(result.markdown, /<b>Bold<\/b> text/);
  assert.match(result.markdown, /!\[飞书图片\]\(\/api\/feishu-media\?token=image-token&type=image&sig=[a-f0-9]{64}\)/);
  assert.match(result.markdown, /\[attachment\.pdf\]\(\/api\/feishu-media\?token=file-token&type=file&sig=[a-f0-9]{64}\)/);
  assert.match(result.markdown, /暂不支持的飞书内容块：18/);
  assert.match(
    result.coverImage ?? "",
    /^\/api\/feishu-media\?token=image-token&type=image&sig=[a-f0-9]{64}$/,
  );
  assert.deepEqual(result.media, [
    { token: "image-token", type: "image" },
    { token: "file-token", type: "file" },
  ]);
});

test("uses the first visual media as the cover candidate and ignores files", () => {
  const result = convertFeishuDocumentToMarkdown(
    {
      docToken: "doc-token",
      title: "Cover order",
      revisionId: "8",
      blocks: [
        {
          block_id: "doc-token",
          block_type: 1,
          children: ["file", "board", "image"],
          page: { style: {}, elements: [] },
        },
        {
          block_id: "file",
          parent_id: "doc-token",
          block_type: 23,
          file: { token: "file-token", name: "attachment.pdf" },
        },
        {
          block_id: "board",
          parent_id: "doc-token",
          block_type: 43,
          board: { token: "board-token" },
        },
        {
          block_id: "image",
          parent_id: "doc-token",
          block_type: 27,
          image: { token: "image-token", width: 640, height: 480 },
        },
      ],
    },
    "signing-secret",
  );

  assert.match(
    result.coverImage ?? "",
    /^\/api\/feishu-media\?token=board-token&type=board&sig=[a-f0-9]{64}&v=board-trim-v1$/,
  );
});
