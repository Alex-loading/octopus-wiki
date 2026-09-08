import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Pencil, Plus, Trash2, Sparkles } from "lucide-react";
import { BookmarkAdminGate, BookmarkEmpty, BookmarkLayout } from "../components/BookmarkUI";
import { DEMO_STATUSES, demoIconOption, emptyDemoDraft, splitDemoTags } from "../content/demos";
import { DemoIcon } from "../components/DemoIcon";
import { DemoIconPicker } from "../components/DemoIconPicker";
import { deleteDemo, saveDemo } from "../content/repository";
import { useDemos } from "../content/useDemos";
import type { Demo } from "../data/demos";
import "../../styles/demos.css";

function ProjectEditor({ project, categories, onSaved, onCancel }: {
  project: Demo | null; categories: string[]; onSaved: () => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(() => project
    ? { ...project, icon: demoIconOption(project.icon)?.value ?? project.icon }
    : emptyDemoDraft());
  const [tags, setTags] = useState(draft.tags.join(", "));
  const [techStack, setTechStack] = useState(draft.techStack.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await saveDemo({ ...draft, tags: splitDemoTags(tags), techStack: splitDemoTags(techStack) }, project?.id);
      onSaved();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally { setBusy(false); }
  };
  return (
    <section className="wonder-editor" aria-label={project ? "编辑项目" : "新增项目"}>
      <h2>{project ? "编辑项目" : "新增项目"}</h2>
      <form className="bookmark-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>项目标题 *
            <input name="title" required maxLength={120} value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <label>简介 * <small>展示在项目卡片上</small>
            <textarea name="description" required maxLength={500} rows={2} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
          </label>
          <label>项目详情 <small>可选，留空时使用简介</small>
            <textarea name="longDescription" maxLength={10000} rows={6} value={draft.longDescription} onChange={e => setDraft({ ...draft, longDescription: e.target.value })} />
          </label>
          <label>部署链接 <small>选填，项目的在线访问地址</small>
            <input name="deploymentUrl" type="url" maxLength={4096} placeholder="https://your-project.com" value={draft.deploymentUrl} onChange={e => setDraft({ ...draft, deploymentUrl: e.target.value })} />
          </label>
          <label>GitHub 链接 <small>选填，项目的 GitHub 仓库地址</small>
            <input name="githubUrl" type="url" maxLength={4096} placeholder="https://github.com/username/project" value={draft.githubUrl} onChange={e => setDraft({ ...draft, githubUrl: e.target.value })} />
          </label>
          <div className="wonder-form-grid">
            <label>分类 *
              <input name="category" list="wonder-categories" required maxLength={40} value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} />
              <datalist id="wonder-categories">{categories.map(category => <option key={category} value={category} />)}</datalist>
            </label>
            <label>项目状态
              <select name="status" value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value as Demo["status"] })}>
                {Object.entries(DEMO_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>项目月份 *
              <input name="date" type="month" required value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} />
            </label>
            <DemoIconPicker value={draft.icon} disabled={busy} onChange={icon => setDraft({ ...draft, icon })} />
          </div>
          <label>标签 <small>可选，用逗号分隔</small>
            <input name="tags" value={tags} onChange={e => setTags(e.target.value)} />
          </label>
          <label>技术栈 <small>可选，用逗号分隔</small>
            <input name="techStack" value={techStack} onChange={e => setTechStack(e.target.value)} />
          </label>
          <div className="wonder-colors">
            <label>封面起始色
              <input type="color" value={draft.colors[0]} onChange={e => setDraft({ ...draft, colors: [e.target.value, draft.colors[1]] })} />
            </label>
            <label>封面结束色
              <input type="color" value={draft.colors[1]} onChange={e => setDraft({ ...draft, colors: [draft.colors[0], e.target.value] })} />
            </label>
            <div className="wonder-cover-preview" aria-label="封面预览" style={{ background: `linear-gradient(135deg, ${draft.colors[0]}, ${draft.colors[1]})` }}><DemoIcon value={draft.icon} size={32} /></div>
          </div>
          <label className="bookmark-check">
            <input name="isPublic" type="checkbox" checked={draft.isPublic} onChange={e => setDraft({ ...draft, isPublic: e.target.checked })} />
            公开这个项目
          </label>
        </fieldset>
        {error && <p role="alert" className="bookmark-error">{error}</p>}
        <div className="bookmark-form-actions">
          <button type="submit" disabled={busy} className="bookmark-button primary">{busy ? "保存中…" : "保存项目"}</button>
          <button type="button" disabled={busy} onClick={onCancel} className="bookmark-button">取消</button>
        </div>
      </form>
    </section>
  );
}

function Management() {
  const library = useDemos(true);
  const [editing, setEditing] = useState<Demo | null | undefined>();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const categories = useMemo(() => [...new Set(library.demos.map(item => item.category))], [library.demos]);
  const items = library.demos.filter(item => (status === "all" || item.status === status)
    && `${item.title} ${item.description} ${item.category} ${item.tags.join(" ")}`.toLowerCase().includes(search.trim().toLowerCase()));
  const remove = async (project: Demo) => {
    if (busy || !window.confirm(`确定删除「${project.title}」吗？删除后无法恢复。`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await deleteDemo(project.id);
      setNotice("项目已删除。");
      library.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "删除失败，请重试。"); }
    finally { setBusy(false); }
  };
  return (
    <>
      <header className="bookmark-heading">
        <div>
          <p className="bookmark-eyebrow">OCTOPUS / ADMIN</p>
          <h1>妙妙屋管理</h1>
          <p>记录每个有趣的项目，把作品和灵感分享出去。</p>
        </div>
        {editing === undefined && <button className="bookmark-button primary" disabled={busy || library.loading || Boolean(library.error)} onClick={() => { setEditing(null); setNotice(""); setError(""); }}><Plus size={16} />新增项目</button>}
      </header>
      {notice && <p role="status" className="bookmark-notice">{notice}</p>}
      {error && <p role="alert" className="bookmark-error">{error}</p>}
      {editing !== undefined ? (
        <ProjectEditor key={editing?.id ?? "new"} project={editing} categories={categories}
          onCancel={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setNotice("项目已保存。"); library.refresh(); }} />
      ) : (
        <>
          <div className="bookmark-admin-filters wonder-filters">
            <input aria-label="搜索项目" placeholder="搜索标题、简介、分类或标签" value={search} onChange={e => setSearch(e.target.value)} />
            <select aria-label="筛选项目状态" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="all">全部状态</option>
              {Object.entries(DEMO_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          {library.loading ? <p role="status">正在加载项目…</p> : library.error ? (
            <div role="alert" className="bookmark-error">{library.error} <button className="bookmark-text-button" onClick={library.refresh}>重试</button></div>
          ) : items.length ? (
            <div className="wonder-admin-list">
              <p className="wonder-result-count">共 {items.length} 个项目</p>
              {items.map(project => (
                <article key={project.id} className="wonder-admin-item">
                  <div className="wonder-item-icon" style={{ background: `linear-gradient(135deg, ${project.colors[0]}, ${project.colors[1]})` }}><DemoIcon value={project.icon} size={28} /></div>
                  <div className="wonder-item-copy">
                    <h2>{project.title}</h2>
                    <p>{project.description}</p>
                    <div className="wonder-item-meta"><span>{DEMO_STATUSES[project.status]}</span><span>{project.isPublic ? "公开" : "仅管理员可见"}</span><span>{project.category}</span><span>{project.date}</span></div>
                  </div>
                  <div className="bookmark-form-actions">
                    <button className="bookmark-text-button" disabled={busy} aria-label={`编辑 ${project.title}`} onClick={() => { setEditing(project); setError(""); setNotice(""); }}><Pencil size={15} />编辑</button>
                    <button className="bookmark-text-button danger" disabled={busy} aria-label={`删除 ${project.title}`} onClick={() => void remove(project)}><Trash2 size={15} />删除</button>
                  </div>
                </article>
              ))}
            </div>
          ) : <BookmarkEmpty title={library.demos.length ? "没有找到匹配项目" : "给妙妙屋添一件作品"}><p>{library.demos.length ? "试试其他关键词或状态。" : "点击新增项目，记录你的第一个作品。"}</p></BookmarkEmpty>}
        </>
      )}
      <footer className="bookmark-page-footer">
        <Link to="/lab" className="inline-flex items-center gap-1.5"><Sparkles size={14} />查看妙妙屋</Link>
        <Link to="/admin/articles">文章管理</Link>
        <Link to="/admin/bookmarks">收藏管理</Link>
      </footer>
    </>
  );
}

export function AdminDemos({ darkMode }: { darkMode: boolean }) {
  return <BookmarkLayout darkMode={darkMode}><BookmarkAdminGate managementPath="/admin/demos" label="妙妙屋"><Management /></BookmarkAdminGate></BookmarkLayout>;
}
