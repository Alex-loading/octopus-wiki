import { useCallback, useEffect, useRef, useState } from "react";
import { listPhotoEntries } from "./photoRepository";
import type { PhotoEntry } from "./photos";

export function usePhotoEntries(admin = false) {
  const [entries, setEntries] = useState<PhotoEntry[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const requestedAfter = useRef<PhotoEntry | undefined>(undefined);
  const nextCursor = useRef<PhotoEntry | undefined>(undefined);

  const load = useCallback(async (after?: PhotoEntry) => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    requestedAfter.current = after;
    setLoading(true);
    setError("");
    try {
      const page = await listPhotoEntries(admin, after, controller.signal);
      if (controller.signal.aborted) return;
      setEntries(current => after
        ? [...current, ...page.entries.filter(entry => !current.some(existing => existing.id === entry.id))]
        : page.entries);
      nextCursor.current = page.entries.at(-1);
      setHasMore(page.hasMore);
      if (!after) setTotal(page.total);
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "照片记录暂时无法读取。");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [admin]);

  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);

  return {
    entries, total, loading, error, hasMore,
    reload: () => load(),
    loadMore: () => load(nextCursor.current),
    retry: () => load(requestedAfter.current),
  };
}
