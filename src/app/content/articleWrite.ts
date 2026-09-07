import { AUTHOR_AVATARS, AUTHOR_NAME_MAX_LENGTH } from "./articleAuthor";

export type FeishuArticleWriteInput = {
  authorName?: string;
  authorAvatar?: string;
  title: string;
  slug: string;
  excerpt: string;
  contentSnapshot: string;
  category: string;
  tags: string[];
  coverImage?: string;
  feishuCoverImage?: string;
  feishuDocUrl: string;
  feishuRevisionId?: string;
  feishuSyncedAt?: string;
};

export function validateFeishuArticleInput(input: FeishuArticleWriteInput): string | null {
  if (!input.title.trim()) return "标题不能为空。";
  if (!input.slug.trim()) return "Slug 不能为空。";
  if (!input.feishuDocUrl.trim()) return "飞书文档链接不能为空。";
  if (!input.contentSnapshot.trim()) return "请先读取飞书文档信息，再保存文章。";
  if (!input.category.trim()) return "分类不能为空。";
  if (Array.from(input.authorName?.trim() ?? "").length > AUTHOR_NAME_MAX_LENGTH) return "作者签名不能超过 40 个字符。";
  if (input.authorAvatar && !AUTHOR_AVATARS.some(avatar => avatar.id === input.authorAvatar)) return "请选择内置章鱼头像。";
  return null;
}

export function resolveArticleCover(
  manualCoverImage?: string,
  feishuCoverImage?: string,
): string | undefined {
  return manualCoverImage?.trim() || feishuCoverImage?.trim() || undefined;
}
