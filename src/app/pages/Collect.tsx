import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Check, ArrowUpRight } from "lucide-react";
import { BookmarkLayout } from "../components/BookmarkUI";
import { BookmarkForm } from "../components/BookmarkForm";
import { CollectorAuthorization } from "../components/CollectorAuthorization";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useCollectorAccess } from "../content/useCollectorAccess";
import { collectorActions } from "../content/collectorClient";
import {
  captureFromSearch,
  type Bookmark,
  type BookmarkCollection,
} from "../content/bookmarks";
import { listBookmarkCollections } from "../content/bookmarkRepository";

function Collector() {
  const location = useLocation();
  const auth = useAdminAuth();
  const device = useCollectorAccess();
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState<Bookmark | null>(null);
  const [version, setVersion] = useState(0);
  const incoming = captureFromSearch(version ? "" : location.search);
  useEffect(() => {
    setSaved(null);
    setVersion(0);
  }, [location.search]);
  useEffect(() => {
    let live = true;
    if (device.loading) return;
    if (device.access.authorized) {
      setCollections(device.access.collections);
      setLoading(false);
      setError("");
      return;
    }
    if (!auth.isAdmin) {
      setCollections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    listBookmarkCollections(true)
      .then((boxes) => {
        if (live) setCollections(boxes);
      })
      .catch((error) => {
        if (live)
          setError(error instanceof Error ? error.message : "收藏箱加载失败。");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [retry, auth.isAdmin, device.loading, device.access]);
  return (
    <div className="bookmark-collector">
      <header className="bookmark-heading">
        <div>
          <p className="bookmark-eyebrow">SAVE SOMETHING GOOD</p>
          <h1>收进收藏箱</h1>
          <p>留住链接，也留下一点自己的想法。</p>
        </div>
      </header>
      <CollectorAuthorization device={device} />
      {device.loading ||
      (auth.checking && !device.access.authorized) ? null : !(
          device.access.authorized || auth.isAdmin
        ) ? null : loading ? (
        <p role="status">正在加载收藏箱…</p>
      ) : error ? (
        <p className="bookmark-error" role="alert">
          {error}{" "}
          <button
            className="bookmark-text-button"
            onClick={() => setRetry((value) => value + 1)}
          >
            重试
          </button>
        </p>
      ) : saved ? (
        <div className="bookmark-success" role="status">
          <Check size={34} />
          <h2>已收好</h2>
          <p>{saved.title}</p>
          <p>
            已放入「
            {collections.find((box) => box.id === saved.collection_id)?.name}」
          </p>
          <div className="bookmark-form-actions">
            <button
              className="bookmark-button primary"
              onClick={() => {
                setSaved(null);
                setVersion((value) => value + 1);
              }}
            >
              继续收藏
            </button>
            <Link to="/admin/bookmarks" className="bookmark-button">
              管理收藏 <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>
      ) : (
        <BookmarkForm
          key={`${location.search}:${version}`}
          collections={collections}
          initial={incoming.draft}
          initialText={incoming.text}
          actions={device.access.authorized ? collectorActions : undefined}
          onCollectionCreated={(box) =>
            setCollections((current) => [...current, box])
          }
          onSaved={setSaved}
        />
      )}
      <footer className="bookmark-page-footer">
        <Link to="/collections">浏览收藏</Link>
        <Link to="/collect/setup">设置快捷收藏</Link>
      </footer>
    </div>
  );
}
export function Collect({ darkMode }: { darkMode: boolean }) {
  return (
    <BookmarkLayout darkMode={darkMode}>
      <Collector />
    </BookmarkLayout>
  );
}
