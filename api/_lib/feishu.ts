import type { FeishuMediaType } from "./media-signature.ts";

export type FeishuDocumentReference = {
  kind: "wiki" | "docx";
  token: string;
};

export class FeishuError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 500,
  ) {
    super(message);
    this.name = "FeishuError";
  }
}

const FEISHU_TOKEN_PATTERN = /^[A-Za-z0-9_-]{6,128}$/;

function isAllowedFeishuHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "feishu.cn" ||
    host.endsWith(".feishu.cn") ||
    host === "larksuite.com" ||
    host.endsWith(".larksuite.com")
  );
}

export function parseFeishuDocumentUrl(rawUrl: string): FeishuDocumentReference {
  try {
    const url = new URL(rawUrl.trim());
    if (url.protocol !== "https:" || !isAllowedFeishuHost(url.hostname)) {
      throw new Error("invalid origin");
    }

    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length !== 2 || (segments[0] !== "wiki" && segments[0] !== "docx")) {
      throw new Error("invalid path");
    }

    const token = decodeURIComponent(segments[1]);
    if (!FEISHU_TOKEN_PATTERN.test(token)) {
      throw new Error("invalid token");
    }

    return { kind: segments[0], token };
  } catch {
    throw new FeishuError(
      "INVALID_FEISHU_URL",
      "请输入有效的飞书 Wiki 或 Docx 文档链接。",
      400,
    );
  }
}

export type FeishuBlock = Record<string, unknown> & {
  block_id?: string;
  block_type?: number;
};

export type FeishuDocument = {
  docToken: string;
  title: string;
  revisionId: string;
  blocks: FeishuBlock[];
};

type FeishuClientOptions = {
  appId: string;
  appSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  baseUrl?: string;
};

type FeishuApiEnvelope<T> = {
  code?: number;
  msg?: string;
  data?: T;
};

export class FeishuClient {
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly baseUrl: string;
  private tenantToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly options: FeishuClientOptions) {
    if (!options.appId || !options.appSecret) {
      throw new FeishuError("FEISHU_CONFIG_MISSING", "服务端未配置飞书应用凭证。", 500);
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? Date.now;
    this.baseUrl = (options.baseUrl ?? "https://open.feishu.cn/open-apis").replace(/\/+$/, "");
  }

  private async readJson<T>(response: Response): Promise<FeishuApiEnvelope<T>> {
    const payload = (await response.json().catch(() => null)) as FeishuApiEnvelope<T> | null;
    if (!response.ok || !payload || payload.code !== 0) {
      throw new FeishuError(
        "FEISHU_API_ERROR",
        payload?.msg ? `飞书接口请求失败：${payload.msg}` : "飞书接口响应异常。",
        502,
      );
    }
    return payload;
  }

  private async getTenantToken(): Promise<string> {
    if (this.tenantToken && this.tenantToken.expiresAt > this.now()) {
      return this.tenantToken.value;
    }

    const response = await this.fetchImpl(`${this.baseUrl}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: this.options.appId, app_secret: this.options.appSecret }),
    });
    const payload = await this.readJson<never>(response) as FeishuApiEnvelope<never> & {
      tenant_access_token?: string;
      expire?: number;
    };
    if (!payload.tenant_access_token) {
      throw new FeishuError("FEISHU_API_ERROR", "飞书未返回 tenant_access_token。", 502);
    }

    const safeLifetime = Math.max(1, Number(payload.expire ?? 7200) - 60) * 1_000;
    this.tenantToken = {
      value: payload.tenant_access_token,
      expiresAt: this.now() + safeLifetime,
    };
    return payload.tenant_access_token;
  }

  private async requestJson<T>(path: string): Promise<T> {
    const token = await this.getTenantToken();
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await this.readJson<T>(response);
    if (payload.data === undefined) {
      throw new FeishuError("FEISHU_API_ERROR", "飞书接口缺少 data 字段。", 502);
    }
    return payload.data;
  }

  private async resolveDocToken(reference: FeishuDocumentReference): Promise<string> {
    if (reference.kind === "docx") return reference.token;
    const data = await this.requestJson<{
      node?: { obj_type?: string; obj_token?: string };
    }>(`/wiki/v2/spaces/get_node?token=${encodeURIComponent(reference.token)}`);
    if (data.node?.obj_type !== "docx" || !data.node.obj_token) {
      throw new FeishuError(
        "UNSUPPORTED_FEISHU_DOCUMENT",
        "该 Wiki 节点不是新版飞书文档（Docx），暂不支持实时渲染。",
        400,
      );
    }
    return data.node.obj_token;
  }

  private async fetchBlocks(docToken: string): Promise<FeishuBlock[]> {
    const blocks: FeishuBlock[] = [];
    let pageToken = "";

    do {
      const params = new URLSearchParams({ page_size: "500", document_revision_id: "-1" });
      if (pageToken) params.set("page_token", pageToken);
      const data = await this.requestJson<{
        items?: FeishuBlock[];
        has_more?: boolean;
        page_token?: string;
      }>(`/docx/v1/documents/${encodeURIComponent(docToken)}/blocks?${params.toString()}`);
      blocks.push(...(data.items ?? []));
      pageToken = data.has_more ? (data.page_token ?? "") : "";
      if (data.has_more && !pageToken) {
        throw new FeishuError("FEISHU_API_ERROR", "飞书 Block 分页缺少 page_token。", 502);
      }
    } while (pageToken);

    return blocks;
  }

  async fetchDocument(rawUrl: string): Promise<FeishuDocument> {
    const reference = parseFeishuDocumentUrl(rawUrl);
    const docToken = await this.resolveDocToken(reference);
    const metadata = await this.requestJson<{
      document?: { title?: string; revision_id?: string | number };
    }>(`/docx/v1/documents/${encodeURIComponent(docToken)}`);
    const blocks = await this.fetchBlocks(docToken);

    return {
      docToken,
      title: metadata.document?.title ?? "未命名飞书文档",
      revisionId: String(metadata.document?.revision_id ?? ""),
      blocks,
    };
  }

  async downloadMedia(token: string, type: FeishuMediaType): Promise<Response> {
    if (!token.trim()) {
      throw new FeishuError("INVALID_MEDIA_TOKEN", "媒体 token 不能为空。", 400);
    }
    const tenantToken = await this.getTenantToken();
    const path = type === "board"
      ? `/board/v1/whiteboards/${encodeURIComponent(token)}/download_as_image`
      : `/drive/v1/medias/${encodeURIComponent(token)}/download`;
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${tenantToken}` },
    });
    if (!response.ok) {
      throw new FeishuError("FEISHU_MEDIA_ERROR", "飞书媒体下载失败。", 502);
    }
    return response;
  }
}

export function createFeishuClientFromEnv(env: NodeJS.ProcessEnv = process.env): FeishuClient {
  return new FeishuClient({
    appId: env.FEISHU_APP_ID ?? "",
    appSecret: env.FEISHU_APP_SECRET ?? "",
  });
}
