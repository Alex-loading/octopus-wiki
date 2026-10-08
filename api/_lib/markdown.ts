import { BlockType, getCodeLanguage, MarkdownRenderer, type Block, type ImageBlock } from "feishu-docx";
import { parseFragment, serialize } from "parse5";

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

  constructor(
    document: ConstructorParameters<typeof MarkdownRenderer>[0],
    private readonly mediaSigningSecret: string,
    private readonly rawContent?: string,
  ) {
    super(document);
  }

  private signImage(html: string, token: string, type: "image" | "board"): string {
    const fragment = parseFragment(html);
    const image = fragment.childNodes.find((node) => "tagName" in node && node.tagName === "img");
    if (!image || !("attrs" in image)) throw new Error("飞书图片缺少 img 元素。");
    image.attrs = image.attrs.filter((attribute) => attribute.name !== "src" && attribute.name !== "alt");
    image.attrs.push(
      { name: "src", value: buildSignedMediaUrl(token, type, this.mediaSigningSecret) },
      { name: "alt", value: type === "board" ? "飞书画板" : "飞书图片" },
    );
    return serialize(fragment);
  }

  override parseImage(image: ImageBlock): string {
    return this.signImage(super.parseImage(image).toString(), image.token, "image");
  }

  override parseBoard(board: ImageBlock): string {
    return this.signImage(super.parseBoard(board).toString(), board.token, "board");
  }

  override parseFile(block: Block): string {
    this.addFileToken("file", block.file.token);
    const url = buildSignedMediaUrl(block.file.token, "file", this.mediaSigningSecret);
    return `[${block.file.name}](${url})\n`;
  }

  override parseGrid(block: Block): string {
    const indent = this.indent;
    const count = block.grid.column_size;
    if (!Number.isInteger(count) || count < 1 || count !== block.children?.length) {
      throw new Error("飞书分栏的列数与内容不一致。");
    }
    const columns = block.children.map((id) => {
      const column = this.blockMap[id];
      if (column?.block_type !== BlockType.GridColumn) throw new Error("飞书分栏缺少 GridColumn。");
      const width = column.grid_column.width_ratio;
      if (!Number.isFinite(width) || width <= 0 || width > 100) throw new Error("飞书分栏宽度必须位于 0 到 100 之间。");
      this.precedingText = null;
      const content = (column.children ?? []).map((childId) => {
        const child = this.blockMap[childId];
        if (!child) throw new Error("飞书分栏缺少子内容块。");
        return this.parseBlock(child, 0);
      }).join("\n");
      // 容器之间保留空行，让列内内容继续经过 Markdown 的代码说明和列表处理。
      return `<div data-feishu-width="${width}">\n\n${content}\n</div>`;
    });
    this.indent = indent;
    this.precedingText = null;
    const content = [`<div data-feishu-grid="${count}">`, ...columns, "</div>"].join("\n\n");
    const prefix = " ".repeat(indent * 4);
    return `\n${content.split("\n").map((line) => line ? `${prefix}${line}` : "").join("\n")}\n`;
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
  }, mediaSigningSecret, document.rawContent);
  const markdown = renderer.parse();
  const media = Object.values(renderer.fileTokens) as RendererMedia[];
  const coverMedia = media.find((item) => item.type === "image" || item.type === "board");

  return {
    markdown: markdown.trim(),
    media,
    coverImage: coverMedia
      ? buildSignedMediaUrl(coverMedia.token, coverMedia.type, mediaSigningSecret)
      : null,
  };
}
