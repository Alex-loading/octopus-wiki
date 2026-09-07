import {
  ContentServiceError,
  getPublicArticleContent,
  previewFeishuContent,
  type ArticleContentGateway,
  type FetchedMarkdown,
} from "./_lib/content-service.ts";
import { createFeishuClientFromEnv, FeishuError } from "./_lib/feishu.ts";
import { convertFeishuDocumentToMarkdown } from "./_lib/markdown.ts";
import { createSupabaseGatewayFromEnv } from "./_lib/supabase.ts";

type HandlerDependencies = {
  gateway: ArticleContentGateway;
  fetchMarkdown: (docUrl: string) => Promise<FetchedMarkdown>;
};

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof ContentServiceError || error instanceof FeishuError) {
    return json({ success: false, code: error.code, message: error.message }, error.status);
  }
  return json(
    { success: false, code: "INTERNAL_ERROR", message: "服务暂时不可用，请稍后重试。" },
    500,
  );
}

function bearerToken(request: Request): string {
  const match = request.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

export function createFeishuContentHandlers(dependencies: HandlerDependencies) {
  return {
    async GET(request: Request): Promise<Response> {
      const slug = new URL(request.url).searchParams.get("slug")?.trim() ?? "";
      if (!slug) {
        return json({ success: false, code: "SLUG_REQUIRED", message: "缺少文章 slug。" }, 400);
      }
      try {
        const data = await getPublicArticleContent(slug, dependencies);
        return json(
          { success: true, data },
          200,
          { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" },
        );
      } catch (error) {
        return errorResponse(error);
      }
    },

    async POST(request: Request): Promise<Response> {
      try {
        const body = (await request.json().catch(() => null)) as { docUrl?: unknown } | null;
        const docUrl = typeof body?.docUrl === "string" ? body.docUrl.trim() : "";
        if (!docUrl) {
          return json(
            { success: false, code: "DOC_URL_REQUIRED", message: "缺少飞书文档链接。" },
            400,
          );
        }
        const data = await previewFeishuContent(
          bearerToken(request),
          docUrl,
          dependencies,
        );
        return json({ success: true, data });
      } catch (error) {
        return errorResponse(error);
      }
    },
  };
}

let runtimeHandlers: ReturnType<typeof createFeishuContentHandlers> | null = null;

function getRuntimeHandlers(): ReturnType<typeof createFeishuContentHandlers> {
  if (runtimeHandlers) return runtimeHandlers;
  const client = createFeishuClientFromEnv();
  const gateway = createSupabaseGatewayFromEnv();
  const signingSecret = process.env.FEISHU_MEDIA_SIGNING_SECRET ?? "";
  if (!signingSecret) throw new Error("FEISHU_MEDIA_SIGNING_SECRET is required");
  runtimeHandlers = createFeishuContentHandlers({
    gateway,
    fetchMarkdown: async (docUrl) => {
      const document = await client.fetchDocument(docUrl);
      const converted = convertFeishuDocumentToMarkdown(document, signingSecret);
      return {
        markdown: converted.markdown,
        revisionId: document.revisionId,
        title: document.title,
        coverImage: converted.coverImage,
      };
    },
  });
  return runtimeHandlers;
}

export async function GET(request: Request): Promise<Response> {
  try {
    return await getRuntimeHandlers().GET(request);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await getRuntimeHandlers().POST(request);
  } catch (error) {
    return errorResponse(error);
  }
}
