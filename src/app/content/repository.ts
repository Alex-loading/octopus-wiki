import { createClient } from "@supabase/supabase-js";
import { createTabSessionStorage, type UserRoleState } from "../auth/adminSession";
import type { Post } from "../data/posts";
import { resolveAuthorAvatar } from "./articleAuthor";
import { posts as staticPosts } from "../data/posts";
import type { Demo } from "../data/demos";
import { resolveDemoLinks, validateDemoDraft, type DemoDraft } from "./demos";
import {
  fetchLiveArticleContent,
  previewFeishuDocument,
  type FeishuPreview,
} from "./liveContent";
import {
  resolveArticleCover,
  validateFeishuArticleInput,
  type FeishuArticleWriteInput,
} from "./articleWrite";
import {
  formatArticleDateTime,
  normalizeCommentAuthor,
  normalizeCommentContent,
  parseArticleLikeState,
  type ArticleComment,
  type ArticleLikeState,
} from "./articleInteractions";

type ArticleRow = {
  author_name?: string | null;
  author_avatar?: string | null;
  id: string | number;
  slug: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  content_md?: string | null;
  cover_image?: string | null;
  tags?: string[] | null;
  category?: string | null;
  read_time?: number | null;
  like_count?: number | null;
  featured?: boolean | null;
  published_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  deleted_at?: string | null;
  feishu_doc_url?: string | null;
  feishu_revision_id?: string | null;
  feishu_synced_at?: string | null;
};

type ArticleCommentRow = {
  id: string | number;
  article_id: string | number;
  author_name?: string | null;
  content?: string | null;
  created_at?: string | null;
};

type DemoRow = {
  id: string | number;
  slug: string;
  title: string;
  description?: string | null;
  long_description?: string | null;
  category?: string | null;
  tags?: string[] | null;
  tech_stack?: string[] | null;
  status?: "live" | "wip" | "planned" | null;
  colors?: [string, string] | null;
  icon?: string | null;
  date?: string | null;
  demo_url?: string | null;
  repo_url?: string | null;
  project_url?: string | null;
  is_public?: boolean;
};

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1499750310107-5fef28a66643?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

const ARTICLE_SELECT_FIELDS =
  "id,slug,title,summary,content,content_md,cover_image,tags,category,read_time,like_count,featured,published_at,updated_at,status,deleted_at,feishu_doc_url,feishu_revision_id,feishu_synced_at,author_name,author_avatar";

const contentSource = (import.meta.env.VITE_CONTENT_SOURCE ?? "auto").toLowerCase();
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
const shouldReadFromDatabase =
  contentSource === "database" ||
  contentSource === "hybrid" ||
  (contentSource === "auto" && hasSupabaseConfig);

const supabase =
  hasSupabaseConfig && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, storage: createTabSessionStorage() },
    })
    : null;

type WriteResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ArticleFeaturedUpdate = {
  id: string;
  featured: boolean;
};

function estimateReadTime(content: string): number {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return 1;
  const words = normalized.split(" ").length;
  return Math.max(1, Math.ceil(words / 280));
}

function normalizeArticle(row: ArticleRow): Post {
  const content = row.content || row.content_md || "";
  const articleDate = row.published_at ?? row.updated_at ?? new Date().toISOString().slice(0, 10);
  return {
    id: String(row.id ?? row.slug),
    authorName: row.author_name?.trim() || undefined,
    authorAvatar: resolveAuthorAvatar(row.author_avatar).id,
    slug: row.slug,
    title: row.title,
    excerpt: row.summary ?? "",
    content,
    coverImage: row.cover_image ?? DEFAULT_COVER,
    tags: row.tags ?? [],
    category: row.category ?? "未分类",
    date: formatArticleDateTime(articleDate),
    readTime: row.read_time ?? estimateReadTime(content),
    likeCount: Math.max(0, Number(row.like_count ?? 0)),
    featured: Boolean(row.featured),
    status: row.status === "draft" ? "draft" : "published",
    feishuDocUrl: row.feishu_doc_url ?? undefined,
    feishuRevisionId: row.feishu_revision_id ?? undefined,
    feishuSyncedAt: row.feishu_synced_at ?? undefined,
  };
}

function normalizeArticleComment(row: ArticleCommentRow): ArticleComment {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    authorName: normalizeCommentAuthor(row.author_name ?? ""),
    content: normalizeCommentContent(row.content ?? ""),
    createdAt: row.created_at ?? "",
  };
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function mapWriteError(error: unknown): string {
  if (!error || typeof error !== "object") return "操作失败，请稍后重试。";
  const message = "message" in error ? String(error.message ?? "") : "";
  const code = "code" in error ? String(error.code ?? "") : "";

  if (code === "23505" || /duplicate|unique/i.test(message)) {
    return "Slug 已存在，请更换后重试。";
  }
  if (/permission|forbidden|not authorized|not allowed/i.test(message)) {
    return "无权限执行该操作。";
  }
  if (/network|fetch/i.test(message)) {
    return "网络异常，请检查连接后重试。";
  }
  return message || "操作失败，请稍后重试。";
}

export function getSupabaseClient() {
  return supabase;
}

export async function getUserRoleState(): Promise<UserRoleState> {
  if (!supabase) {
    return { authenticated: false, isAdmin: false, userId: null };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { authenticated: false, isAdmin: false, userId: null };
  }

  const appMeta = data.user.app_metadata ?? {};
  const role = String(appMeta.role ?? "").toLowerCase();
  const isAdminFlag = appMeta.is_admin === true || String(appMeta.is_admin ?? "").toLowerCase() === "true";

  return {
    authenticated: true,
    isAdmin: role === "admin" || isAdminFlag,
    userId: data.user.id,
  };
}

export async function signOutAdmin(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw new Error(error.message || "退出登录失败，请重试。");
}

function normalizeDemo(row: DemoRow): Demo {
  return {
    id: String(row.id ?? row.slug),
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    longDescription: row.long_description ?? "",
    category: row.category ?? "工具",
    tags: row.tags ?? [],
    techStack: row.tech_stack ?? [],
    status: row.status ?? "planned",
    colors: row.colors ?? ["#64748b", "#475569"],
    icon: row.icon ?? "✦",
    date: row.date ?? "",
    ...resolveDemoLinks(row),
    isPublic: row.is_public === true,
  };
}

function fallbackArticles(): Post[] {
  return staticPosts;
}

export async function listArticles(): Promise<Post[]> {
  if (!shouldReadFromDatabase || !supabase) {
    return fallbackArticles();
  }

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT_FIELDS)
    .eq("status", "published")
    .is("deleted_at", null)
    .order("published_at", { ascending: false, nullsFirst: false });

  if (error || !data) {
    return fallbackArticles();
  }

  return (data as ArticleRow[]).map(normalizeArticle);
}

export async function getArticleBySlug(slug: string): Promise<Post | null> {
  if (!shouldReadFromDatabase || !supabase) {
    return fallbackArticles().find((item) => item.slug === slug) ?? null;
  }

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT_FIELDS)
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return fallbackArticles().find((item) => item.slug === slug) ?? null;
  }

  const snapshot = normalizeArticle(data as ArticleRow);
  if (!snapshot.feishuDocUrl) return snapshot;

  try {
    return await fetchLiveArticleContent(snapshot);
  } catch {
    return snapshot;
  }
}

export async function getArticleLikeState(
  articleId: string,
  visitorId: string,
  fallbackLikeCount = 0,
): Promise<WriteResult<ArticleLikeState>> {
  if (!supabase) {
    return {
      ok: true,
      data: { likeCount: Math.max(0, fallbackLikeCount), liked: false },
    };
  }

  const { data, error } = await supabase.rpc("get_article_like_state", {
    p_article_id: articleId,
    p_visitor_id: visitorId,
  });
  if (error) return { ok: false, error: mapWriteError(error) };
  return { ok: true, data: parseArticleLikeState(data, fallbackLikeCount) };
}

export async function setArticleLiked(
  articleId: string,
  visitorId: string,
  liked: boolean,
): Promise<WriteResult<ArticleLikeState>> {
  if (!supabase) return { ok: false, error: "Supabase 未配置，暂时无法点赞。" };

  const { data, error } = await supabase.rpc("set_article_like", {
    p_article_id: articleId,
    p_visitor_id: visitorId,
    p_liked: liked,
  });
  if (error) return { ok: false, error: mapWriteError(error) };
  return { ok: true, data: parseArticleLikeState(data) };
}

export async function listArticleComments(
  articleId: string,
): Promise<WriteResult<ArticleComment[]>> {
  if (!supabase) return { ok: true, data: [] };

  const { data, error } = await supabase
    .from("article_comments")
    .select("id,article_id,author_name,content,created_at")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: mapWriteError(error) };
  return { ok: true, data: ((data ?? []) as ArticleCommentRow[]).map(normalizeArticleComment) };
}

export async function createArticleComment(
  articleId: string,
  authorName: string,
  content: string,
): Promise<WriteResult<ArticleComment>> {
  const normalizedContent = normalizeCommentContent(content);
  if (!normalizedContent) return { ok: false, error: "评论内容不能为空。" };
  if (!supabase) return { ok: false, error: "Supabase 未配置，暂时无法发布评论。" };

  const { data, error } = await supabase
    .from("article_comments")
    .insert({
      article_id: articleId,
      author_name: normalizeCommentAuthor(authorName),
      content: normalizedContent,
    })
    .select("id,article_id,author_name,content,created_at")
    .maybeSingle();
  if (error) return { ok: false, error: mapWriteError(error) };
  if (!data) return { ok: false, error: "评论发布失败，请稍后重试。" };
  return { ok: true, data: normalizeArticleComment(data as ArticleCommentRow) };
}

export async function deleteArticleComment(
  articleId: string,
  commentId: string,
): Promise<WriteResult<{ id: string }>> {
  if (!supabase) return { ok: false, error: "Supabase 未配置，暂时无法删除评论。" };

  try {
    const roleState = await getUserRoleState();
    if (!roleState.authenticated || !roleState.isAdmin) {
      return { ok: false, error: "仅管理员可以删除评论。" };
    }

    // RLS is authoritative; UI/auth checks alone cannot authorize a deletion.
    const { data, error } = await supabase
      .from("article_comments")
      .delete()
      .eq("id", commentId)
      .eq("article_id", articleId)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: mapWriteError(error) };
    if (!data) return { ok: false, error: "评论不存在、已被删除或无权限删除，请刷新后重试。" };
    return { ok: true, data: { id: String(data.id) } };
  } catch (error) {
    return { ok: false, error: mapWriteError(error) };
  }
}

const DEMO_SELECT_FIELDS = "id,slug,title,description,long_description,category,tags,tech_stack,status,colors,icon,date,demo_url,repo_url,project_url,is_public";

function demoClient() {
  if (!supabase) throw new Error("妙妙屋服务尚未配置，请配置 Supabase。");
  return supabase;
}

async function adminDemoClient() {
  const db = demoClient();
  const role = await getUserRoleState();
  if (!role.authenticated || !role.isAdmin) throw new Error("请先登录管理员账号。");
  return db;
}

function failDemo(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (["42P01", "42703", "PGRST204", "PGRST205"].includes(error.code ?? ""))
    throw new Error("妙妙屋数据表尚未就绪，请先应用 009_wonder_room.sql 迁移。");
  if (error.code === "42501") throw new Error("没有操作权限，请重新登录管理员账号。");
  if (error.code === "23505") throw new Error("项目标识已存在，请重试。");
  throw new Error(error.message || "妙妙屋服务暂时不可用，请稍后重试。");
}

export async function listDemos(admin = false): Promise<Demo[]> {
  const db = admin ? await adminDemoClient() : demoClient();
  const output: Demo[] = [];
  for (let offset = 0; ; offset += 500) {
    let query = db.from("demos").select(DEMO_SELECT_FIELDS)
      .order("date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }).order("id")
      .range(offset, offset + 499);
    // Public pages must show the same records even when an admin is signed in.
    if (!admin) query = query.eq("is_public", true);
    const { data, error } = await query;
    failDemo(error);
    output.push(...((data ?? []) as DemoRow[]).map(normalizeDemo));
    if (!data || data.length < 500) return output;
  }
}

export async function saveDemo(draft: DemoDraft, id?: string): Promise<Demo> {
  const payload = validateDemoDraft(draft);
  const db = await adminDemoClient();
  const query = id ? db.from("demos").update(payload).eq("id", id)
    : db.from("demos").insert({ ...payload, slug: crypto.randomUUID() });
  const { data, error } = await query.select(DEMO_SELECT_FIELDS).single();
  failDemo(error);
  return normalizeDemo(data as DemoRow);
}

export async function deleteDemo(id: string): Promise<void> {
  const db = await adminDemoClient();
  const { data, error } = await db.from("demos").delete().eq("id", id).select("id");
  failDemo(error);
  if (!data?.length) throw new Error("项目不存在或没有删除权限，请刷新后重试。");
}

export async function listDemosByArticle(articleSlug: string): Promise<Demo[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("article_demos")
    .select(`order_index,demos!inner(${DEMO_SELECT_FIELDS}),articles!inner(slug)` )
    .eq("demos.is_public", true)
    .eq("articles.status", "published")
    .is("articles.deleted_at", null)
    .eq("articles.slug", articleSlug)
    .order("order_index", { ascending: true });

  if (error || !data) {
    return [];
  }

  return (
    data as unknown as Array<{ demos: DemoRow[] | DemoRow | null }>
  ).flatMap((item) => {
    if (!item.demos) return [];
    if (Array.isArray(item.demos)) {
      return item.demos.map(normalizeDemo);
    }
    return [normalizeDemo(item.demos)];
  });
}

export async function listAdminArticles(): Promise<WriteResult<Post[]>> {
  if (!supabase) {
    return { ok: false, error: "Supabase 未配置，无法读取后台文章。" };
  }

  const roleState = await getUserRoleState();
  if (!roleState.authenticated) {
    return { ok: false, error: "请先登录管理员账号。" };
  }
  if (!roleState.isAdmin) {
    return { ok: false, error: "当前账号不是管理员。" };
  }

  const { data, error } = await supabase
    .from("articles")
    .select(ARTICLE_SELECT_FIELDS)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false, nullsFirst: false });

  if (error || !data) {
    return { ok: false, error: mapWriteError(error) };
  }

  return { ok: true, data: (data as ArticleRow[]).map(normalizeArticle) };
}

async function ensureUniqueSlug(slug: string, excludeId?: string): Promise<WriteResult<null>> {
  if (!supabase) return { ok: false, error: "Supabase 未配置。" };

  let query = supabase
    .from("articles")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .limit(1);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  if (error) {
    return { ok: false, error: mapWriteError(error) };
  }

  if ((data ?? []).length > 0) {
    return { ok: false, error: "Slug 已存在，请更换后重试。" };
  }

  return { ok: true, data: null };
}

function toArticleRowPayload(input: FeishuArticleWriteInput, userId: string | null) {
  const now = new Date().toISOString();
  const coverImage = resolveArticleCover(input.coverImage, input.feishuCoverImage);
  return {
    title: input.title.trim(),
    author_name: input.authorName?.trim() || null,
    author_avatar: resolveAuthorAvatar(input.authorAvatar).id,
    slug: normalizeSlug(input.slug),
    summary: input.excerpt.trim(),
    content: input.contentSnapshot,
    content_md: input.contentSnapshot,
    category: input.category.trim() || "未分类",
    tags: input.tags,
    cover_image: coverImage ?? null,
    feishu_doc_url: input.feishuDocUrl.trim(),
    feishu_revision_id: input.feishuRevisionId?.trim() || null,
    feishu_synced_at: input.feishuSyncedAt?.trim() || null,
    read_time: estimateReadTime(input.contentSnapshot),
    updated_at: now,
    updated_by: userId,
  };
}

export async function createArticle(input: FeishuArticleWriteInput): Promise<WriteResult<null>> {
  const validation = validateFeishuArticleInput(input);
  if (validation) return { ok: false, error: validation };
  if (!supabase) return { ok: false, error: "Supabase 未配置。" };

  const roleState = await getUserRoleState();
  if (!roleState.authenticated) return { ok: false, error: "请先登录管理员账号。" };
  if (!roleState.isAdmin) return { ok: false, error: "当前账号不是管理员。" };

  const normalizedSlug = normalizeSlug(input.slug);
  const uniqueCheck = await ensureUniqueSlug(normalizedSlug);
  if (!uniqueCheck.ok) return uniqueCheck;

  const payload = {
    ...toArticleRowPayload({ ...input, slug: normalizedSlug }, roleState.userId),
    status: "draft",
    deleted_at: null,
  };

  const { error } = await supabase.from("articles").insert(payload);
  if (error) return { ok: false, error: mapWriteError(error) };

  return { ok: true, data: null };
}

export async function updateArticle(id: string, input: FeishuArticleWriteInput): Promise<WriteResult<null>> {
  const validation = validateFeishuArticleInput(input);
  if (validation) return { ok: false, error: validation };
  if (!supabase) return { ok: false, error: "Supabase 未配置。" };

  const roleState = await getUserRoleState();
  if (!roleState.authenticated) return { ok: false, error: "请先登录管理员账号。" };
  if (!roleState.isAdmin) return { ok: false, error: "当前账号不是管理员。" };

  const normalizedSlug = normalizeSlug(input.slug);
  const uniqueCheck = await ensureUniqueSlug(normalizedSlug, id);
  if (!uniqueCheck.ok) return uniqueCheck;

  const payload = toArticleRowPayload({ ...input, slug: normalizedSlug }, roleState.userId);

  const { error } = await supabase.from("articles").update(payload).eq("id", id).is("deleted_at", null);
  if (error) return { ok: false, error: mapWriteError(error) };

  return { ok: true, data: null };
}

export async function deleteArticle(id: string): Promise<WriteResult<null>> {
  if (!supabase) return { ok: false, error: "Supabase 未配置。" };

  const roleState = await getUserRoleState();
  if (!roleState.authenticated) return { ok: false, error: "请先登录管理员账号。" };
  if (!roleState.isAdmin) return { ok: false, error: "当前账号不是管理员。" };

  const { error } = await supabase
    .from("articles")
    .update({
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      updated_by: roleState.userId,
      status: "draft",
    })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) return { ok: false, error: mapWriteError(error) };
  return { ok: true, data: null };
}

export async function publishArticle(id: string, status: "published" | "draft"): Promise<WriteResult<null>> {
  if (!supabase) return { ok: false, error: "Supabase 未配置。" };

  const roleState = await getUserRoleState();
  if (!roleState.authenticated) return { ok: false, error: "请先登录管理员账号。" };
  if (!roleState.isAdmin) return { ok: false, error: "当前账号不是管理员。" };

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
    updated_by: roleState.userId,
  };
  if (status === "published") {
    updates.published_at = new Date().toISOString();
  }

  const { error } = await supabase.from("articles").update(updates).eq("id", id).is("deleted_at", null);
  if (error) return { ok: false, error: mapWriteError(error) };
  return { ok: true, data: null };
}

export async function setArticleFeatured(id: string, featured: boolean): Promise<WriteResult<ArticleFeaturedUpdate>> {
  if (!supabase) return { ok: false, error: "Supabase 未配置。" };

  const roleState = await getUserRoleState();
  if (!roleState.authenticated) return { ok: false, error: "请先登录管理员账号。" };
  if (!roleState.isAdmin) return { ok: false, error: "当前账号不是管理员。" };

  const { data, error } = await supabase
    .from("articles")
    .update({
      featured,
      updated_at: new Date().toISOString(),
      updated_by: roleState.userId,
    })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id,featured")
    .maybeSingle();

  if (error) return { ok: false, error: mapWriteError(error) };
  if (!data) return { ok: false, error: "文章不存在或已被删除。" };

  return {
    ok: true,
    data: {
      id: String(data.id),
      featured: Boolean(data.featured),
    },
  };
}

export async function syncFeishuDocument(docUrl: string): Promise<WriteResult<FeishuPreview>> {
  if (!docUrl.trim()) {
    return { ok: false, error: "飞书文档链接不能为空。" };
  }
  if (!supabase) {
    return { ok: false, error: "Supabase 未配置，无法验证管理员身份。" };
  }

  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token ?? "";
  if (error || !accessToken) {
    return { ok: false, error: "登录状态已失效，请重新登录。" };
  }

  try {
    return {
      ok: true,
      data: await previewFeishuDocument(docUrl, accessToken),
    };
  } catch (previewError) {
    return { ok: false, error: mapWriteError(previewError) };
  }
}
