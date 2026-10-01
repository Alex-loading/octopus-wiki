import { BlockType, getCodeLanguage, MarkdownRenderer, type Block } from "feishu-docx";

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

function blockPlainText(block: Block): string | null {
  const body = Object.values(block).find((value) =>
    value !== null && typeof value === "object" && "elements" in value,
  ) as { elements?: { text_run?: { content?: string } }[] } | undefined;
  if (!Array.isArray(body?.elements)) return null;
  if (!body.elements.every((element) => typeof element.text_run?.content === "string")) return null;
  return body.elements.map((element) => element.text_run!.content!).join("");
}

function codeCaption(
  rawContent: string | undefined,
  code: string,
  precedingText: string | null,
): string | undefined {
  if (!rawContent || !code || !precedingText) return undefined;
  const codeStart = rawContent.indexOf(code);
  if (codeStart < 0 || codeStart !== rawContent.lastIndexOf(code)) return undefined;
  const precedingStart = rawContent.lastIndexOf(precedingText, codeStart);
  if (precedingStart < 0 || (precedingStart > 0 && rawContent[precedingStart - 1] !== "\n")) {
    return undefined;
  }
  const precedingEnd = precedingStart + precedingText.length;
  const between = rawContent.slice(precedingEnd, codeStart);
  if (!between.startsWith("\n")) return undefined;
  return between.trim() || undefined;
}

class ArticleMarkdownRenderer extends MarkdownRenderer {
  private precedingText: string | null = null;

  constructor(document: ConstructorParameters<typeof MarkdownRenderer>[0], private readonly rawContent?: string) {
    super(document);
  }

  override parseBlock(block: Block, indent: number): string {
    const precedingText = this.precedingText;
    const plainText = block ? blockPlainText(block) : null;
    if (plainText || block?.block_type !== BlockType.Text) this.precedingText = plainText;
    if (block?.block_type !== BlockType.Code) return super.parseBlock(block, indent);

    this.indent = indent;
    this.currentBlock = block;
    const code = this.parseTextBlock(block, block.code).toString().replace(/\n$/, "");
    const prefix = " ".repeat(indent * 4);
    // 纯文本中的说明位于前文与完整代码之间，关联时要求代码正文唯一。
    const caption = codeCaption(this.rawContent, code, precedingText);
    const fenceCharacter = caption?.includes("`") ? "~" : "`";
    const fenceRuns = code.match(fenceCharacter === "~" ? /~+/g : /`+/g) ?? [];
    const fenceLength = Math.max(3, ...fenceRuns.map((run) => run.length + 1));
    const fence = fenceCharacter.repeat(fenceLength);
    const metadata = caption ? ` feishu-caption=${JSON.stringify(caption)}` : "";
    const lines = [`${fence}${getCodeLanguage(block.code.style.language)}${metadata}`, ...code.split("\n"), fence];

    // 列表缩进同时应用于分隔符和代码内容，保留代码自身的缩进与空行。
    return `\n${lines.map((line) => `${prefix}${line}`).join("\n")}\n`;
  }
}

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

  const renderer = new ArticleMarkdownRenderer({
    document: {
      document_id: document.docToken,
      revision_id: document.revisionId,
      title: document.title,
    },
    blocks: document.blocks.map(unsupportedPlaceholder),
  }, document.rawContent);
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
