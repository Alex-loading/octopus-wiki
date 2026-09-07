import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import {
  BookmarkAdminGate,
  BookmarkCard,
  BookmarkEmpty,
  BookmarkLayout,
} from "../components/BookmarkUI";
import { BookmarkForm } from "../components/BookmarkForm";
import { useBookmarkLibrary } from "../content/useBookmarkLibrary";
import {
  deleteBookmark,
  deleteBookmarkCollection,
  saveBookmarkCollection,
} from "../content/bookmarkRepository";
import {
  PLATFORMS,
  type Bookmark,
  type BookmarkCollection,
  type CollectionDraft,
} from "../content/bookmarks";

function CollectionEditor({
  box,
  onDone,
  onCancel,
}: {
  box: BookmarkCollection | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<CollectionDraft>(
    box ?? { name: "", description: "", is_public: true, sort_order: 0 },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await saveBookmarkCollection(draft, box?.id);
      onDone();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="bookmark-form">
      <fieldset disabled={busy}>
        <label>
          收藏箱名称
          <input
            required
            maxLength={80}
            value={draft.name}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <label>
          说明
          <textarea
            maxLength={500}
            rows={2}
            value={draft.description}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
          />
        </label>
        <label>
          排序 <small>数字越小越靠前</small>
          <input
            type="number"
            step="1"
            min="-1000000"
            max="1000000"
            value={draft.sort_order}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                sort_order: Number(event.target.value),
              }))
            }
          />
        </label>
        <label className="bookmark-check">
          <input
            type="checkbox"
            checked={draft.is_public}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                is_public: event.target.checked,
              }))
            }
          />
          公开这个收藏箱
        </label>
      </fieldset>
      {error && (
        <p role="alert" className="bookmark-error">
          {error}
        </p>
      )}
      <div className="bookmark-form-actions">
        <button
          type="submit"
          disabled={busy}
          className="bookmark-button primary"
        >
          {busy ? "保存中…" : "保存收藏箱"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="bookmark-button"
        >
          取消
        </button>
      </div>
    </form>
  );
}
function Management() {
  const library = useBookmarkLibrary(true);
  const [tab, setTab] = useState<"bookmarks" | "collections">("bookmarks");
  const [search, setSearch] = useState("");
  const [collectionId, setCollectionId] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [editing, setEditing] = useState<Bookmark | null>(null);
  const [editingBox, setEditingBox] = useState<
    BookmarkCollection | null | undefined
  >();
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    title: string;
    collection: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const items = useMemo(
    () =>
      library.bookmarks.filter(
        (item) =>
          (collectionId === "all" || item.collection_id === collectionId) &&
          (platform === "all" || item.platform === platform) &&
          `${item.title} ${item.note} ${item.url}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()),
      ),
    [library.bookmarks, collectionId, platform, search],
  );
  const done = () => {
    setEditing(null);
    setEditingBox(undefined);
    setNotice("已保存。");
    library.refresh();
  };
  const confirmDelete = async () => {
    if (!pendingDelete || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await (pendingDelete.collection
        ? deleteBookmarkCollection(pendingDelete.id)
        : deleteBookmark(pendingDelete.id));
      setPendingDelete(null);
      setNotice("已删除。");
      library.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "删除失败，请重试。");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <header className="bookmark-heading">
        <div>
          <p className="bookmark-eyebrow">OCTOPUS / ADMIN</p>
          <h1>收藏管理</h1>
          <p>把好内容归好类，也决定哪些值得分享。</p>
        </div>
        <Link to="/collect" className="bookmark-button primary">
          <Plus size={16} />
          添加收藏
        </Link>
      </header>
      <div className="bookmark-filters">
        <button
          aria-pressed={tab === "bookmarks"}
          onClick={() => setTab("bookmarks")}
        >
          资源 · {library.bookmarks.length}
        </button>
        <button
          aria-pressed={tab === "collections"}
          onClick={() => setTab("collections")}
        >
          收藏箱 · {library.collections.length}
        </button>
        <Link className="bookmark-text-button" to="/collect/setup">
          设置快捷收藏
        </Link>
      </div>
      {notice && (
        <p role="status" className="bookmark-hint">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="bookmark-error">
          {error}
        </p>
      )}
      {pendingDelete && (
        <div className="bookmark-delete-confirm" role="alert">
          <p>
            删除{pendingDelete.collection ? "收藏箱" : "收藏"}「
            {pendingDelete.title}」？
            {pendingDelete.collection
              ? "箱内有资源时无法删除。"
              : "这条收藏记录会永久删除，原平台内容不受影响。"}
          </p>
          <div className="bookmark-form-actions">
            <button
              className="bookmark-button danger"
              disabled={busy}
              onClick={confirmDelete}
            >
              {busy ? "删除中…" : "确认删除"}
            </button>
            <button
              className="bookmark-button"
              disabled={busy}
              onClick={() => {
                setPendingDelete(null);
                setError("");
              }}
            >
              取消
            </button>
          </div>
        </div>
      )}
      {editing && (
        <section className="bookmark-editor">
          <div className="bookmark-field-heading">
            <h2>编辑收藏</h2>
            <button
              className="bookmark-text-button"
              aria-label="关闭编辑"
              onClick={() => setEditing(null)}
            >
              <X size={18} />
            </button>
          </div>
          <BookmarkForm
            key={editing.id}
            collections={library.collections}
            initial={editing}
            bookmarkId={editing.id}
            onCollectionCreated={(box) =>
              library.setCollections((current) => [...current, box])
            }
            onSaved={done}
            onCancel={() => setEditing(null)}
          />
        </section>
      )}
      {editingBox !== undefined && (
        <section className="bookmark-editor">
          <h2>{editingBox ? "编辑收藏箱" : "新建收藏箱"}</h2>
          <CollectionEditor
            key={editingBox?.id ?? "new"}
            box={editingBox}
            onDone={done}
            onCancel={() => setEditingBox(undefined)}
          />
        </section>
      )}
      {library.loading ? (
        <p role="status" className="bookmark-status">
          正在加载收藏…
        </p>
      ) : library.error ? (
        <p role="alert" className="bookmark-error">
          {library.error}{" "}
          <button onClick={library.refresh} className="bookmark-text-button">
            重试
          </button>
        </p>
      ) : tab === "bookmarks" ? (
        <>
          <div className="bookmark-admin-filters">
            <input
              aria-label="搜索收藏资源"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题、链接、备注…"
            />
            <select
              aria-label="筛选收藏箱"
              value={collectionId}
              onChange={(event) => setCollectionId(event.target.value)}
            >
              <option value="all">全部收藏箱</option>
              {library.collections.map((box) => (
                <option key={box.id} value={box.id}>
                  {box.name}
                </option>
              ))}
            </select>
            <select
              aria-label="筛选平台"
              value={platform}
              onChange={(event) => setPlatform(event.target.value)}
            >
              <option value="all">全部平台</option>
              {Object.entries(PLATFORMS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value.label}
                </option>
              ))}
            </select>
          </div>
          {items.length ? (
            <div className="bookmark-grid">
              {items.map((item) => (
                <BookmarkCard key={item.id} bookmark={item}>
                  <span className="bookmark-box-name">
                    {
                      library.collections.find(
                        (box) => box.id === item.collection_id,
                      )?.name
                    }
                  </span>
                  <button
                    className="bookmark-text-button"
                    onClick={() => {
                      setEditing(item);
                      setEditingBox(undefined);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    aria-label={`编辑 ${item.title}`}
                  >
                    <Pencil size={14} />
                    编辑
                  </button>
                  <button
                    className="bookmark-text-button danger"
                    onClick={() => {
                      setPendingDelete({
                        id: item.id,
                        title: item.title,
                        collection: false,
                      });
                      setError("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    aria-label={`删除 ${item.title}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </BookmarkCard>
              ))}
            </div>
          ) : (
            <BookmarkEmpty title="没有找到收藏">
              <p>添加第一条收藏，或者调整筛选条件。</p>
            </BookmarkEmpty>
          )}
        </>
      ) : (
        <>
          <div className="bookmark-toolbar">
            <h2>收藏箱</h2>
            <button
              className="bookmark-button"
              onClick={() => {
                setEditingBox(null);
                setEditing(null);
              }}
            >
              <Plus size={15} />
              新建收藏箱
            </button>
          </div>
          {library.collections.length ? (
            <div className="bookmark-box-list">
              {library.collections.map((box) => (
                <div className="bookmark-box-row" key={box.id}>
                  <div>
                    <h3>
                      {box.name}{" "}
                      <small>{box.is_public ? "公开" : "私密"}</small>
                    </h3>
                    <p>
                      {box.description || "暂无说明"} ·{" "}
                      {
                        library.bookmarks.filter(
                          (item) => item.collection_id === box.id,
                        ).length
                      }{" "}
                      条收藏
                    </p>
                  </div>
                  <div className="bookmark-form-actions">
                    <button
                      className="bookmark-text-button"
                      onClick={() => {
                        setEditingBox(box);
                        setEditing(null);
                      }}
                      aria-label={`编辑收藏箱 ${box.name}`}
                    >
                      <Pencil size={15} />
                      编辑
                    </button>
                    <button
                      className="bookmark-text-button danger"
                      aria-label={`删除收藏箱 ${box.name}`}
                      onClick={() => {
                        setPendingDelete({
                          id: box.id,
                          title: box.name,
                          collection: true,
                        });
                        setError("");
                      }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <BookmarkEmpty title="先建一个收藏箱">
              <p>例如：前端开发、面试准备、生活灵感。</p>
            </BookmarkEmpty>
          )}
        </>
      )}
      <footer className="bookmark-page-footer">
        <Link to="/collections">查看公开收藏页</Link>
        <Link to="/admin/articles">文章管理</Link>
      </footer>
    </>
  );
}
export function AdminBookmarks({ darkMode }: { darkMode: boolean }) {
  return (
    <BookmarkLayout darkMode={darkMode}>
      <BookmarkAdminGate>
        <Management />
      </BookmarkAdminGate>
    </BookmarkLayout>
  );
}
