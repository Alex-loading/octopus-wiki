import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Pencil, Plus, Save, Trash2, ShieldAlert, CheckCircle2 } from "lucide-react";
import type { Post } from "../data/posts";
import {
  listAdminArticles,
  createArticle,
  updateArticle,
  deleteArticle,
  publishArticle,
  setArticleFeatured,
  getUserRoleState,
  signOutAdmin,
} from "../content/repository";

interface AdminArticlesProps {
  darkMode: boolean;
}

interface ArticleFormState {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string;
  coverImage: string;
}

const EMPTY_FORM: ArticleFormState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  category: "技术",
  tags: "",
  coverImage: "",
};

function toFormValue(post: Post): ArticleFormState {
  return {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    category: post.category,
    tags: post.tags.join(","),
    coverImage: post.coverImage,
  };
}

export function AdminArticles({ darkMode }: AdminArticlesProps) {
  const dm = darkMode;
  const navigate = useNavigate();

  const [checkingAccess, setCheckingAccess] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [articles, setArticles] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [togglingFeaturedId, setTogglingFeaturedId] = useState<string | null>(null);
  const [form, setForm] = useState<ArticleFormState>(EMPTY_FORM);

  const editingArticle = useMemo(
    () => articles.find((article) => article.id === editingId) ?? null,
    [articles, editingId]
  );

  const refreshArticles = async () => {
    setLoading(true);
    setError("");
    const result = await listAdminArticles();
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setArticles(result.data);
    setLoading(false);
  };

  useEffect(() => {
    const init = async () => {
      const roleState = await getUserRoleState();
      if (!roleState.authenticated) {
        navigate("/admin/login?next=/admin/articles", { replace: true });
        return;
      }
      if (!roleState.isAdmin) {
        setForbidden(true);
        setCheckingAccess(false);
        return;
      }

      setCheckingAccess(false);
      await refreshArticles();
    };

    void init();
  }, [navigate]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    const payload = {
      title: form.title,
      slug: form.slug,
      excerpt: form.excerpt,
      content: form.content,
      category: form.category,
      tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      coverImage: form.coverImage,
    };

    const result = editingId
      ? await updateArticle(editingId, payload)
      : await createArticle(payload);

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(editingId ? "文章已更新" : "文章已创建");
    resetForm();
    await refreshArticles();
  };

  const handleDelete = async (id: string, title: string) => {
    const confirmed = window.confirm(`确认删除文章「${title}」？`);
    if (!confirmed) return;

    setError("");
    setNotice("");
    const result = await deleteArticle(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice("文章已删除");
    if (editingId === id) {
      resetForm();
    }
    await refreshArticles();
  };

  const handlePublishSwitch = async (id: string, nextStatus: "published" | "draft") => {
    const result = await publishArticle(id, nextStatus);
    if (!result.ok) {
      setError(result.error);
      return;
    }

    setNotice(nextStatus === "published" ? "文章已发布" : "文章已切换为草稿");
    await refreshArticles();
  };

  const handleFeaturedSwitch = async (id: string, nextFeatured: boolean) => {
    setError("");
    setNotice("");
    setTogglingFeaturedId(id);

    const result = await setArticleFeatured(id, nextFeatured);
    setTogglingFeaturedId(null);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    let matched = false;
    setArticles((prev) => prev.map((article) => {
      if (article.id !== result.data.id) return article;
      matched = true;
      return { ...article, featured: result.data.featured };
    }));

    if (!matched) {
      await refreshArticles();
    }

    setNotice(result.data.featured ? "已设为精选" : "已取消精选");
  };

  if (checkingAccess) {
    return (
      <div className={`min-h-screen pt-24 flex items-center justify-center ${dm ? "bg-gray-950 text-gray-400" : "bg-white text-gray-500"}`}>
        正在检查权限...
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className={`min-h-screen pt-24 ${dm ? "bg-gray-950" : "bg-white"}`}>
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <ShieldAlert className={`mx-auto mb-3 ${dm ? "text-rose-400" : "text-rose-500"}`} />
          <h1 className={`text-3xl font-light mb-2 ${dm ? "text-white" : "text-gray-900"}`}>无权限访问</h1>
          <p className={dm ? "text-gray-400" : "text-gray-500"}>当前账号不是管理员，无法访问文章管理页面。</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen pt-24 pb-16 ${dm ? "bg-gray-950" : "bg-white"}`}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className={`text-sm mb-1 ${dm ? "text-indigo-400" : "text-indigo-600"}`}>管理后台</p>
            <h1 className={`text-3xl font-light ${dm ? "text-white" : "text-gray-900"}`}>文章管理</h1>
          </div>
          <button
            onClick={async () => {
              await signOutAdmin();
              navigate("/admin/login", { replace: true });
            }}
            className={`text-sm px-3 py-2 rounded-lg border ${dm ? "border-white/10 text-gray-300 hover:text-white" : "border-gray-200 text-gray-600 hover:text-gray-900"}`}
          >
            退出登录
          </button>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          <section className={`lg:col-span-2 rounded-2xl border p-5 ${dm ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`text-lg ${dm ? "text-white" : "text-gray-900"}`}>{editingArticle ? "编辑文章" : "新建文章"}</h2>
              {editingArticle && (
                <button onClick={resetForm} className={`text-xs ${dm ? "text-gray-400" : "text-gray-500"}`}>取消编辑</button>
              )}
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              {([
                { key: "title", label: "标题" },
                { key: "slug", label: "Slug" },
                { key: "excerpt", label: "摘要" },
                { key: "category", label: "分类" },
                { key: "tags", label: "标签（逗号分隔）" },
                { key: "coverImage", label: "封面图 URL" },
              ] as const).map(({ key, label }) => (
                <label key={key} className="block">
                  <span className={`text-xs mb-1 block ${dm ? "text-gray-400" : "text-gray-500"}`}>{label}</span>
                  <input
                    value={form[key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))}
                    className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${dm ? "bg-gray-950 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                  />
                </label>
              ))}

              <label className="block">
                <span className={`text-xs mb-1 block ${dm ? "text-gray-400" : "text-gray-500"}`}>正文（Markdown）</span>
                <textarea
                  rows={10}
                  value={form.content}
                  onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none resize-y ${dm ? "bg-gray-950 border-white/10 text-white" : "bg-gray-50 border-gray-200 text-gray-900"}`}
                />
              </label>

              {error && <p className="text-sm text-rose-500">{error}</p>}
              {notice && (
                <p className="text-sm text-emerald-500 inline-flex items-center gap-1">
                  <CheckCircle2 size={14} /> {notice}
                </p>
              )}

              <button
                disabled={saving}
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 ${saving
                  ? dm ? "bg-white/10 text-gray-500" : "bg-gray-200 text-gray-400"
                  : dm ? "bg-indigo-500 text-white hover:bg-indigo-400" : "bg-indigo-600 text-white hover:bg-indigo-700"
                  }`}
              >
                {editingArticle ? <Save size={14} /> : <Plus size={14} />}
                {saving ? "保存中..." : editingArticle ? "保存修改" : "创建文章"}
              </button>
            </form>
          </section>

          <section className={`lg:col-span-3 rounded-2xl border p-5 ${dm ? "bg-gray-900 border-white/10" : "bg-white border-gray-200"}`}>
            <h2 className={`text-lg mb-4 ${dm ? "text-white" : "text-gray-900"}`}>文章列表</h2>

            {loading ? (
              <p className={dm ? "text-gray-500" : "text-gray-400"}>加载中...</p>
            ) : articles.length === 0 ? (
              <p className={dm ? "text-gray-500" : "text-gray-400"}>暂无文章</p>
            ) : (
              <div className="space-y-2">
                {articles.map((article) => {
                  const status = article.status ?? "draft";
                  const isFeatured = Boolean(article.featured);
                  const isTogglingFeatured = togglingFeaturedId === article.id;
                  return (
                    <div
                      key={article.id}
                      className={`rounded-xl border p-3 ${dm ? "border-white/10 bg-gray-950" : "border-gray-200 bg-gray-50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={dm ? "text-white" : "text-gray-900"}>{article.title}</p>
                          <p className={`text-xs mt-1 ${dm ? "text-gray-500" : "text-gray-500"}`}>{article.slug}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingId(article.id);
                              setForm(toFormValue(article));
                              setNotice("");
                              setError("");
                            }}
                            className={`p-2 rounded-lg ${dm ? "hover:bg-white/10 text-gray-300" : "hover:bg-white text-gray-600"}`}
                            title="编辑"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(article.id, article.title)}
                            className={`p-2 rounded-lg ${dm ? "hover:bg-rose-500/20 text-rose-400" : "hover:bg-rose-50 text-rose-500"}`}
                            title="删除"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded-full ${status === "published"
                          ? dm ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-600"
                          : dm ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-600"
                          }`}>
                          {status === "published" ? "已发布" : "草稿"}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full ${isFeatured
                          ? dm ? "bg-indigo-500/20 text-indigo-300" : "bg-indigo-100 text-indigo-600"
                          : dm ? "bg-gray-800 text-gray-400" : "bg-gray-200 text-gray-600"
                          }`}>
                          {isFeatured ? "精选" : "普通"}
                        </span>
                        <button
                          onClick={() => handlePublishSwitch(article.id, status === "published" ? "draft" : "published")}
                          className={`text-xs px-2.5 py-1 rounded-lg border ${dm ? "border-white/10 text-gray-300 hover:text-white" : "border-gray-200 text-gray-600 hover:text-gray-900"}`}
                        >
                          {status === "published" ? "转为草稿" : "发布"}
                        </button>
                        <button
                          onClick={() => handleFeaturedSwitch(article.id, !isFeatured)}
                          disabled={isTogglingFeatured}
                          className={`text-xs px-2.5 py-1 rounded-lg border ${isTogglingFeatured
                            ? dm ? "border-white/10 text-gray-500" : "border-gray-200 text-gray-400"
                            : dm ? "border-white/10 text-gray-300 hover:text-white" : "border-gray-200 text-gray-600 hover:text-gray-900"
                            }`}
                        >
                          {isTogglingFeatured ? "处理中..." : isFeatured ? "取消精选" : "设为精选"}
                        </button>
                        <span className={`text-xs ${dm ? "text-gray-500" : "text-gray-500"}`}>更新时间：{article.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
