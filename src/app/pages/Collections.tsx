import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ArrowLeft,
  ArrowUpRight,
  FolderOpen,
  Plus,
  Search,
} from "lucide-react";
import {
  BookmarkCard,
  BookmarkEmpty,
  BookmarkLayout,
} from "../components/BookmarkUI";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useBookmarkLibrary } from "../content/useBookmarkLibrary";
import { PLATFORMS } from "../content/bookmarks";

export function Collections({ darkMode }: { darkMode: boolean }) {
  const library = useBookmarkLibrary();
  const auth = useAdminAuth();
  const location = useLocation();
  const collectionId = location.pathname.startsWith("/collections/")
    ? location.pathname.slice("/collections/".length)
    : "";
  const collection = library.collections.find(
    (item) => item.id === collectionId,
  );
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const items = useMemo(
    () =>
      library.bookmarks.filter(
        (item) =>
          (!collectionId || item.collection_id === collectionId) &&
          (platform === "all" || item.platform === platform) &&
          `${item.title} ${item.note}`
            .toLowerCase()
            .includes(search.toLowerCase().trim()),
      ),
    [library.bookmarks, collectionId, platform, search],
  );
  const counts = useMemo(() => {
    const counts = new Map<string, number>();
    library.bookmarks.forEach((item) =>
      counts.set(item.collection_id, (counts.get(item.collection_id) ?? 0) + 1),
    );
    return counts;
  }, [library.bookmarks]);
  return (
    <BookmarkLayout darkMode={darkMode}>
      {collectionId && (
        <Link to="/collections" className="bookmark-back">
          <ArrowLeft size={15} /> 全部收藏箱
        </Link>
      )}
      <header className="bookmark-heading">
        <div>
          <p className="bookmark-eyebrow">OCTOPUS / COLLECTIONS</p>
          <h1>
            {collectionId
              ? collection?.name || "收藏箱"
              : "把值得回看的，收在这里。"}
          </h1>
          <p>
            {collectionId
              ? collection?.description
              : "散落在不同平台的灵感、知识与好内容。按主题整理，随时回到原处。"}
          </p>
        </div>
        {auth.isAdmin && (
          <Link to="/collect" className="bookmark-button primary">
            <Plus size={16} /> 添加收藏
          </Link>
        )}
      </header>
      {library.loading ? (
        <p role="status" className="bookmark-status">
          正在打开收藏箱…
        </p>
      ) : library.error ? (
        <div role="alert" className="bookmark-error">
          {library.error}{" "}
          <button onClick={library.refresh} className="bookmark-text-button">
            重试
          </button>
        </div>
      ) : collectionId && !collection ? (
        <BookmarkEmpty title="收藏箱不存在或未公开">
          <p>可以返回目录浏览其他收藏。</p>
        </BookmarkEmpty>
      ) : (
        <>
          {!collectionId && (
            <>
              <div className="bookmark-section-label">
                <span>收藏箱</span>
                <span>
                  {library.collections.length} 个箱子 ·{" "}
                  {library.bookmarks.length} 条收藏
                </span>
              </div>
              {library.collections.length === 0 ? (
                <BookmarkEmpty title="收藏箱还空着">
                  <p>值得分享的内容，会慢慢收在这里。</p>
                  {auth.isAdmin && (
                    <Link to="/admin/bookmarks" className="bookmark-button">
                      创建第一个收藏箱
                    </Link>
                  )}
                </BookmarkEmpty>
              ) : (
                <div className="bookmark-box-grid">
                  {library.collections.map((box, index) => (
                    <Link
                      className="bookmark-box"
                      to={`/collections/${box.id}`}
                      key={box.id}
                    >
                      <div className="bookmark-box-top">
                        <FolderOpen size={30} strokeWidth={1.2} />
                        <span>{String(index + 1).padStart(2, "0")}</span>
                      </div>
                      <h2>{box.name}</h2>
                      <p>{box.description || "一些想再次打开的内容。"}</p>
                      <div className="bookmark-box-bottom">
                        <span>{counts.get(box.id) ?? 0} 条收藏</span>
                        <ArrowUpRight size={18} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
          {(collectionId || library.bookmarks.length > 0) && (
            <>
              <div className="bookmark-toolbar">
                <h2>{collectionId ? "箱内收藏" : "最近收藏"}</h2>
                <label className="bookmark-search">
                  <Search size={16} />
                  <input
                    aria-label="搜索收藏"
                    placeholder="搜索标题、备注…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
              </div>
              <div className="bookmark-filters" aria-label="按平台筛选">
                <button
                  aria-pressed={platform === "all"}
                  onClick={() => setPlatform("all")}
                >
                  全部平台
                </button>
                {Object.entries(PLATFORMS).map(([key, value]) => (
                  <button
                    key={key}
                    aria-pressed={platform === key}
                    onClick={() => setPlatform(key)}
                  >
                    {value.label}
                  </button>
                ))}
              </div>
              {items.length ? (
                <div className="bookmark-grid">
                  {items.map((item) => (
                    <BookmarkCard key={item.id} bookmark={item} />
                  ))}
                </div>
              ) : (
                <BookmarkEmpty
                  title={
                    search || platform !== "all"
                      ? "没有匹配的收藏"
                      : "这个箱子还没有公开收藏"
                  }
                >
                  <p>换个关键词或平台试试。</p>
                </BookmarkEmpty>
              )}
            </>
          )}
        </>
      )}
      {auth.isAdmin && (
        <footer className="bookmark-page-footer">
          <Link to="/admin/bookmarks">管理收藏</Link>
          <Link to="/collect/setup">设置快捷收藏</Link>
        </footer>
      )}
    </BookmarkLayout>
  );
}
