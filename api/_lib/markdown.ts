import { MarkdownRenderer } from "feishu-docx";

import type { FeishuBlock, FeishuDocument } from "./feishu.ts";
import {
  buildSignedMediaUrl,
  type FeishuMediaType,
} from "./media-signature.ts";

const SUPPORTED_BLOCK_TYPES = new Set([
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 22, 23, 24, 25,
  26, 27, 31, 32, 33, 34, 43, 999,
]);

type RendererMedia = {
  token: string;
  type: FeishuMediaType;
};

export type MarkdownConversionResult = {
  markdown: string;
  media: RendererMedia[];
  coverImage: string | null;
};

function unsupportedPlaceholder(block: FeishuBlock): FeishuBlock {
  if (SUPPORTED_BLOCK_TYPES.has(Number(block.block_type))) return block;
  return {
    ...block,
    block_type: 2,
    text: {
      style: {},
      elements: [{
        text_run: {
          content: `[暂不支持的飞书内容块：${String(block.block_type ?? "unknown")}]`,
          text_element_style: {},
        },
      }],
    },
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteMedia(markdown: string, media: RendererMedia[], secret: string): string {
  let output = markdown;
  for (const item of media) {
    const signedUrl = buildSignedMediaUrl(item.token, item.type, secret);
    if (item.type === "image" || item.type === "board") {
      const imagePattern = new RegExp(
        `<img\\s+[^>]*src=["']${escapeRegExp(item.token)}["'][^>]*\\/?>`,
        "g",
      );
      output = output.replace(
        imagePattern,
        `![${item.type === "board" ? "飞书画板" : "飞书图片"}](${signedUrl})`,
      );
      continue;
    }
    output = output.split(item.token).join(signedUrl);
  }
  return output;
}

export function convertFeishuDocumentToMarkdown(
  document: FeishuDocument,
  mediaSigningSecret: string,
): MarkdownConversionResult {
  if (!mediaSigningSecret) {
    throw new Error("FEISHU_MEDIA_SIGNING_SECRET is required");
  }

  const renderer = new MarkdownRenderer({
    document: {
      document_id: document.docToken,
      revision_id: document.revisionId,
      title: document.title,
    },
    blocks: document.blocks.map(unsupportedPlaceholder),
  });
  const markdown = renderer.parse();
  const media = Object.values(renderer.fileTokens) as RendererMedia[];
  const coverMedia = media.find((item) => item.type === "image" || item.type === "board");

  return {
    markdown: rewriteMedia(markdown, media, mediaSigningSecret).trim(),
    media,
    coverImage: coverMedia
      ? buildSignedMediaUrl(coverMedia.token, coverMedia.type, mediaSigningSecret)
      : null,
  };
}
