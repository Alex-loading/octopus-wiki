import { useCallback, useEffect, useState } from "react";
import { listBookmarkCollections, listBookmarks } from "./bookmarkRepository";
import type { Bookmark, BookmarkCollection } from "./bookmarks";

export function useBookmarkLibrary(admin = false) {
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError("");
    Promise.all([listBookmarkCollections(admin), listBookmarks({ admin })])
      .then(([boxes, items]) => {
        if (live) {
          setCollections(boxes);
          setBookmarks(items);
        }
      })
      .catch((error) => {
        if (live) {
          setCollections([]);
          setBookmarks([]);
          setError(
            error instanceof Error ? error.message : "收藏加载失败，请重试。",
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [admin, revision]);
  return { collections, bookmarks, error, loading, refresh, setCollections };
}
