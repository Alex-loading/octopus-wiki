import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  ArticleContentGateway,
  ArticleContentSnapshot,
  ArticleSnapshotUpdate,
} from "./content-service.ts";

type ArticleRow = {
  id: string;
  slug: string;
  content?: string | null;
  content_md?: string | null;
  feishu_doc_url?: string | null;
  feishu_revision_id?: string | null;
  feishu_synced_at?: string | null;
};

export class SupabaseArticleContentGateway implements ArticleContentGateway {
  constructor(private readonly client: SupabaseClient) {}

  async findPublishedArticleBySlug(slug: string): Promise<ArticleContentSnapshot | null> {
    const { data, error } = await this.client
      .from("articles")
      .select("id,slug,content,content_md,feishu_doc_url,feishu_revision_id,feishu_synced_at")
      .eq("slug", slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const row = data as ArticleRow;
    return {
      id: row.id,
      slug: row.slug,
      content: row.content || row.content_md || "",
      feishuDocUrl: row.feishu_doc_url ?? null,
      feishuRevisionId: row.feishu_revision_id ?? null,
      feishuSyncedAt: row.feishu_synced_at ?? null,
    };
  }

  async updateArticleSnapshot(id: string, update: ArticleSnapshotUpdate): Promise<void> {
    const { error } = await this.client
      .from("articles")
      .update({
        content: update.content,
        content_md: update.content,
        feishu_revision_id: update.revisionId,
        feishu_synced_at: update.syncedAt,
        updated_at: update.syncedAt,
      })
      .eq("id", id);
    if (error) throw error;
  }

  async isAdminAccessToken(accessToken: string): Promise<boolean> {
    const { data, error } = await this.client.auth.getUser(accessToken);
    if (error || !data.user) return false;
    const metadata = data.user.app_metadata ?? {};
    return (
      String(metadata.role ?? "").toLowerCase() === "admin" ||
      metadata.is_admin === true ||
      String(metadata.is_admin ?? "").toLowerCase() === "true"
    );
  }
}

export function createSupabaseGatewayFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): SupabaseArticleContentGateway {
  const url = env.SUPABASE_URL ?? "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return new SupabaseArticleContentGateway(client);
}
