import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { ArrowUpRight, FolderOpen, Lock } from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { safeAdminReturnPath } from "../auth/adminSession";
import {
  PLATFORMS,
  parseBookmarkUrl,
  type Bookmark,
} from "../content/bookmarks";
import "../../styles/bookmarks.css";
import { downloadBookmarkCover } from "../content/bookmarkRepository";

function useBookmarkCover(bookmark: Bookmark) {
  const path = bookmark.cover_storage_path;
  const [loaded, setLoaded] = useState<{ path: string; url: string }>();
  useEffect(() => {
    if (!path) return;
    let active = true;
    let objectUrl = "";
    void downloadBookmarkCover(path).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setLoaded({ path, url: objectUrl });
    }).catch(() => { /* Missing access or files keep the platform placeholder. */ });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path]);
  // Once archived, never retry the expiring external URL or expose a private cover.
  return path ? loaded?.path === path ? loaded.url : "" : bookmark.cover_url;
}

export function BookmarkLayout({
  darkMode,
  children,
}: {
  darkMode: boolean;
  children: ReactNode;
}) {
  return (
    <main className="bookmark-page" data-theme={darkMode ? "dark" : "light"}>
      <div className="bookmark-shell">{children}</div>
    </main>
  );
}
export function BookmarkAdminGate({ children, managementPath = "/admin/bookmarks", label = "收藏" }: { children: ReactNode; managementPath?: string; label?: string }) {
  const auth = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    // AnimatePresence keeps the exiting page mounted after navigation.
    if (!["/collect", managementPath].includes(location.pathname)) return;
    if (!auth.checking && !auth.authenticated) {
      const next = safeAdminReturnPath(
        location.pathname + location.search + location.hash,
      );
      navigate(`/admin/login?next=${encodeURIComponent(next)}`, {
        replace: true,
      });
    }
  }, [
    auth.checking,
    auth.authenticated,
    location.pathname,
    location.search,
    location.hash,
    navigate,
    managementPath,
  ]);
  if (auth.checking || !auth.authenticated)
    return <p role="status">正在确认管理员身份…</p>;
  if (!auth.isAdmin)
    return (
      <div className="bookmark-empty">
        <Lock />
        <h1>无权限访问</h1>
        <p>请使用管理员账号管理{label}。</p>
        <Link to="/admin/login" className="bookmark-button">
          切换账号
        </Link>
      </div>
    );
  return <>{children}</>;
}
export function BookmarkEmpty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="bookmark-empty">
      <FolderOpen size={36} strokeWidth={1.2} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function BookmarkCard({
  bookmark,
  children,
}: {
  bookmark: Bookmark;
  children?: ReactNode;
}) {
  const [broken, setBroken] = useState(false);
  const cover = useBookmarkCover(bookmark);
  useEffect(() => setBroken(false), [cover]);
  const platform = PLATFORMS[bookmark.platform] ?? PLATFORMS.other;
  let href = "";
  try {
    href = parseBookmarkUrl(bookmark.url).href;
  } catch {
    /* Do not turn invalid stored values into links. */
  }
  return (
    <article className="bookmark-card">
      <a
        href={href || undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="bookmark-card-link"
        aria-label={`${bookmark.title}，打开原链接`}
      >
        <div
          className="bookmark-cover"
          style={{ "--platform-color": platform.color } as React.CSSProperties}
        >
          {cover && !broken ? (
            <img
              src={cover}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setBroken(true)}
            />
          ) : (
            <span aria-hidden="true" className="bookmark-platform-art">
              {platform.mark}
            </span>
          )}
          <span className="bookmark-platform">{platform.label}</span>
          <ArrowUpRight size={17} className="bookmark-open-icon" />
        </div>
        <div className="bookmark-card-body">
          <h2>{bookmark.title}</h2>
          {bookmark.note && <p>{bookmark.note}</p>}
          <div className="bookmark-card-meta">
            <span>
              {new Date(bookmark.created_at).toLocaleDateString("zh-CN")}
            </span>
            {!bookmark.is_public && (
              <span>
                <Lock size={11} /> 私密
              </span>
            )}
          </div>
        </div>
      </a>
      {children && <div className="bookmark-card-actions">{children}</div>}
    </article>
  );
}
