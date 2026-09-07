import assert from "node:assert/strict";
import test from "node:test";

import { convertFeishuDocumentToMarkdown } from "../../api/_lib/markdown.ts";

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
    /^\/api\/feishu-media\?token=board-token&type=board&sig=[a-f0-9]{64}$/,
  );
});
