import { createClient } from "@supabase/supabase-js";
import type { Post } from "../data/posts";
import { posts as staticPosts } from "../data/posts";
import type { Demo } from "../data/demos";
import { demos as staticDemos } from "../data/demos";

type ArticleRow = {
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
  featured?: boolean | null;
  published_at?: string | null;
  updated_at?: string | null;
  status?: string | null;
  deleted_at?: string | null;
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
};

const DEFAULT_COVER =
  "https://images.unsplash.com/photo-1499750310107-5fef28a66643?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

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
      auth: { persistSession: false },
    })
    : null;

type UserRoleState = {
  authenticated: boolean;
  isAdmin: boolean;
  userId: string | null;
};

type WriteResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

type ArticleWriteInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  coverImage?: string;
};

function estimateReadTime(content: string): number {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (!normalized) return 1;
  const words = normalized.split(" ").length;
  return Math.max(1, Math.ceil(words / 280));
}

function normalizeArticle(row: ArticleRow): Post {
  const content = row.content ?? row.content_md ?? "";
  return {
    id: String(row.id ?? row.slug),
    slug: row.slug,
    title: row.title,
    excerpt: row.summary ?? "",
    content,
    coverImage: row.cover_image ?? DEFAULT_COVER,
    tags: row.tags ?? [],
    category: row.category ?? "未分类",
    date: row.published_at ?? row.updated_at ?? new Date().toISOString().slice(0, 10),
    readTime: row.read_time ?? estimateReadTime(content),
    featured: Boolean(row.featured),
    status: row.status === "draft" ? "draft" : "published",
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

function validateArticleInput(input: ArticleWriteInput): string | null {
  if (!input.title.trim()) return "标题不能为空。";
  if (!input.slug.trim()) return "Slug 不能为空。";
  if (!input.content.trim()) return "正文不能为空。";
  return null;
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
  await supabase.auth.signOut();
}

function normalizeDemo(row: DemoRow): Demo {
  return {
    id: String(row.id ?? row.slug),
    slug: row.slug,
    title: row.title,
    description: row.description ?? "",
    longDescription: row.long_description ?? row.description ?? "",
    category: row.category ?? "工具",
    tags: row.tags ?? [],
    techStack: row.tech_stack ?? [],
    status: row.status ?? "planned",
    colors: row.colors ?? ["#64748b", "#475569"],
    icon: row.icon ?? "✦",
    date: row.date ?? new Date().toISOString().slice(0, 7),
  };
}

function fallbackArticles(): Post[] {
  return staticPosts;
}

function fallbackDemos(): Demo[] {
  return staticDemos;
}

export async function listArticles(): Promise<Post[]> {
  if (!shouldReadFromDatabase || !supabase) {
    return fallbackArticles();
  }

  const { data, error } = await supabase
    .from("articles")
    .select("id,slug,title,summary,content,content_md,cover_image,tags,category,read_time,featured,published_at,updated_at,status,deleted_at")
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
    .select("id,slug,title,summary,content,content_md,cover_image,tags,category,read_time,featured,published_at,updated_at,status,deleted_at")
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !data) {
    return fallbackArticles().find((item) => item.slug === slug) ?? null;
  }

  return normalizeArticle(data as ArticleRow);
}

export async function listDemos(): Promise<Demo[]> {
  if (!shouldReadFromDatabase || !supabase) {
    return fallbackDemos();
  }

  const { data, error } = await supabase
    .from("demos")
    .select("id,slug,title,description,long_description,category,tags,tech_stack,status,colors,icon,date,demo_url,repo_url")
    .order("date", { ascending: false, nullsFirst: false });

  if (error || !data) {
    return fallbackDemos();
  }

  return (data as DemoRow[]).map(normalizeDemo);
}

export async function listDemosByArticle(articleSlug: string): Promise<Demo[]> {
  if (!shouldReadFromDatabase || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("article_demos")
    .select("order_index,demos(id,slug,title,description,long_description,category,tags,tech_stack,status,colors,icon,date,demo_url,repo_url),articles!inner(slug)")
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
    .select("id,slug,title,summary,content,content_md,cover_image,tags,category,read_time,featured,published_at,updated_at,status,deleted_at")
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

function toArticleRowPayload(input: ArticleWriteInput, userId: string | null) {
  const now = new Date().toISOString();
  return {
    title: input.title.trim(),
    slug: normalizeSlug(input.slug),
    summary: input.excerpt.trim(),
    content: input.content,
    content_md: input.content,
    category: input.category.trim() || "未分类",
    tags: input.tags,
    cover_image: input.coverImage?.trim() || null,
    read_time: estimateReadTime(input.content),
    updated_at: now,
    updated_by: userId,
  };
}

export async function createArticle(input: ArticleWriteInput): Promise<WriteResult<null>> {
  const validation = validateArticleInput(input);
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

export async function updateArticle(id: string, input: ArticleWriteInput): Promise<WriteResult<null>> {
  const validation = validateArticleInput(input);
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
