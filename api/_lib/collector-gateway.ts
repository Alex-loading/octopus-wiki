import {
  createClient,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type {
  Bookmark,
  BookmarkCollection,
  CollectionDraft,
  validateBookmarkDraft,
} from "../../src/app/content/bookmarks.ts";

export type CaptureDevice = {
  user_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
};
export interface CollectorGateway {
  adminId(token: string): Promise<string | null>;
  isOwnerAdmin(id: string): Promise<boolean>;
  findDevice(hash: string): Promise<CaptureDevice | null>;
  addDevice(device: CaptureDevice): Promise<void>;
  revokeDevice(hash: string, at: string): Promise<void>;
  revokeAll(userId: string, at: string): Promise<void>;
  collections(): Promise<BookmarkCollection[]>;
  createBookmark(
    payload: ReturnType<typeof validateBookmarkDraft>,
  ): Promise<Bookmark>;
  createCollection(payload: CollectionDraft): Promise<BookmarkCollection>;
}
export class CollectorError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
function fail(error: { code?: string } | null, collection = false) {
  if (!error) return;
  if (["42P01", "PGRST205"].includes(error.code ?? ""))
    throw new CollectorError(
      "收藏服务尚未就绪，请先应用 007 和 008 数据库迁移。",
      503,
    );
  if (error.code === "23505")
    throw new CollectorError(
      collection
        ? "已有同名收藏箱，请选择它或使用其他名称。"
        : "这条链接已经收藏过，请到收藏管理中查看或移动。",
      409,
    );
  if (["23503", "23001"].includes(error.code ?? ""))
    throw new CollectorError("收藏箱已不存在，请重新选择。", 409);
  throw new CollectorError("收藏服务暂时不可用，请稍后重试。", 503);
}
// Match the database's app_metadata policy; user_metadata is never trusted.
export function isCollectorAdmin(user: User | null): boolean {
  const metadata = user?.app_metadata;
  return Boolean(
    user &&
    (metadata?.role === "admin" ||
      metadata?.is_admin === true ||
      metadata?.is_admin === "true"),
  );
}
export class SupabaseCollectorGateway implements CollectorGateway {
  constructor(private readonly client: SupabaseClient) {}
  async adminId(token: string) {
    const { data, error } = await this.client.auth.getUser(token);
    if (error) {
      if (error.status && error.status < 500) return null;
      throw new CollectorError("暂时无法验证管理员身份，请稍后重试。", 503);
    }
    return isCollectorAdmin(data.user) ? data.user!.id : null;
  }
  async isOwnerAdmin(id: string) {
    const { data, error } = await this.client.auth.admin.getUserById(id);
    if (error) {
      if (error.status === 404 || error.code === "user_not_found") return false;
      throw new CollectorError("暂时无法验证设备授权，请稍后重试。", 503);
    }
    return isCollectorAdmin(data.user);
  }
  async findDevice(hash: string) {
    const { data, error } = await this.client
      .from("bookmark_capture_devices")
      .select("user_id,token_hash,expires_at,revoked_at")
      .eq("token_hash", hash)
      .maybeSingle();
    fail(error);
    return data as CaptureDevice | null;
  }
  async addDevice(device: CaptureDevice) {
    const { error } = await this.client
      .from("bookmark_capture_devices")
      .insert(device);
    fail(error);
  }
  async revokeDevice(hash: string, at: string) {
    const { error } = await this.client
      .from("bookmark_capture_devices")
      .update({ revoked_at: at })
      .eq("token_hash", hash)
      .is("revoked_at", null);
    fail(error);
  }
  async revokeAll(userId: string, at: string) {
    const { error } = await this.client
      .from("bookmark_capture_devices")
      .update({ revoked_at: at })
      .eq("user_id", userId)
      .is("revoked_at", null);
    fail(error);
  }
  async collections() {
    const rows: BookmarkCollection[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await this.client
        .from("bookmark_collections")
        .select("*")
        .order("sort_order")
        .order("created_at")
        .order("id")
        .range(offset, offset + 499);
      fail(error);
      rows.push(...(data ?? []));
      if (!data || data.length < 500) return rows;
    }
  }
  async createBookmark(payload: ReturnType<typeof validateBookmarkDraft>) {
    const { data, error } = await this.client
      .from("bookmarks")
      .insert(payload)
      .select("*")
      .single();
    fail(error);
    return data as Bookmark;
  }
  async createCollection(payload: CollectionDraft) {
    const { data, error } = await this.client
      .from("bookmark_collections")
      .insert(payload)
      .select("*")
      .single();
    fail(error, true);
    return data as BookmarkCollection;
  }
}
export function createCollectorGatewayFromEnv() {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: key } = process.env;
  if (!url || !key)
    throw new CollectorError("免登录收藏服务尚未配置，请联系管理员。", 503);
  return new SupabaseCollectorGateway(
    createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
}
