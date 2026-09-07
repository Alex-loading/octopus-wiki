export type ArticleContentSnapshot = {
  id: string;
  slug: string;
  content: string;
  feishuDocUrl: string | null;
  feishuRevisionId: string | null;
  feishuSyncedAt: string | null;
};

export type ArticleSnapshotUpdate = {
  content: string;
  revisionId: string;
  syncedAt: string;
};

export interface ArticleContentGateway {
  findPublishedArticleBySlug(slug: string): Promise<ArticleContentSnapshot | null>;
  updateArticleSnapshot(id: string, update: ArticleSnapshotUpdate): Promise<void>;
  isAdminAccessToken(accessToken: string): Promise<boolean>;
}

export type FetchedMarkdown = {
  markdown: string;
  revisionId: string;
  title: string;
  coverImage: string | null;
};

type ContentServiceDependencies = {
  gateway: ArticleContentGateway;
  fetchMarkdown: (docUrl: string) => Promise<FetchedMarkdown>;
  now?: () => Date;
};

export type PublicArticleContent = {
  markdown: string;
  revisionId: string | null;
  syncedAt: string | null;
  stale: boolean;
  source: "live" | "snapshot";
};

export class ContentServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ContentServiceError";
  }
}

function snapshotResult(
  article: ArticleContentSnapshot,
  stale: boolean,
): PublicArticleContent {
  return {
    markdown: article.content,
    revisionId: article.feishuRevisionId,
    syncedAt: article.feishuSyncedAt,
    stale,
    source: "snapshot",
  };
}

export async function getPublicArticleContent(
  slug: string,
  dependencies: ContentServiceDependencies,
): Promise<PublicArticleContent> {
  const article = await dependencies.gateway.findPublishedArticleBySlug(slug);
  if (!article) {
    throw new ContentServiceError("ARTICLE_NOT_FOUND", "文章不存在或尚未发布。", 404);
  }
  if (!article.feishuDocUrl) {
    return snapshotResult(article, false);
  }

  try {
    const live = await dependencies.fetchMarkdown(article.feishuDocUrl);
    const syncedAt = (dependencies.now?.() ?? new Date()).toISOString();
    await dependencies.gateway.updateArticleSnapshot(article.id, {
      content: live.markdown,
      revisionId: live.revisionId,
      syncedAt,
    }).catch(() => undefined);
    return {
      markdown: live.markdown,
      revisionId: live.revisionId,
      syncedAt,
      stale: false,
      source: "live",
    };
  } catch (error) {
    if (article.content.trim()) {
      return snapshotResult(article, true);
    }
    throw new ContentServiceError(
      "FEISHU_CONTENT_UNAVAILABLE",
      "飞书内容暂时不可用，且该文章没有可用快照。",
      502,
      error,
    );
  }
}

export async function previewFeishuContent(
  accessToken: string,
  docUrl: string,
  dependencies: ContentServiceDependencies,
): Promise<FetchedMarkdown> {
  if (!accessToken || !(await dependencies.gateway.isAdminAccessToken(accessToken))) {
    throw new ContentServiceError("ADMIN_REQUIRED", "仅管理员可以同步飞书文档。", 403);
  }
  return dependencies.fetchMarkdown(docUrl);
}
