import { useCallback, useEffect, useState } from "react";
import { listDemos } from "./repository";
import type { Demo } from "../data/demos";

export function useDemos(admin = false) {
  const [demos, setDemos] = useState<Demo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listDemos(admin).then(items => {
      if (active) setDemos(items);
    }).catch(error => {
      if (active) {
        setDemos([]);
        setError(error instanceof Error ? error.message : "妙妙屋加载失败，请重试。");
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [admin, revision]);
  return { demos, loading, error, refresh };
}
