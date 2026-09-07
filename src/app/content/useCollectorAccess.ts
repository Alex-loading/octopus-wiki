import { useEffect, useRef, useState } from "react";
import {
  authorizeCollector,
  getCollectorAccess,
  revokeCollector,
  type CollectorAccess,
} from "./collectorClient";

export function useCollectorAccess() {
  const [access, setAccess] = useState<CollectorAccess>({ authorized: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const live = useRef(false);
  const pending = useRef(false);
  useEffect(() => {
    let active = true;
    live.current = true;
    getCollectorAccess()
      .then((value) => {
        if (active) setAccess(value);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error ? error.message : "无法读取设备授权。",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      live.current = false;
    };
  }, []);
  const run = async (
    operation: () => Promise<CollectorAccess>,
    message = "",
  ) => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const next = await operation();
      if (live.current) {
        setAccess(next);
        setNotice(message);
      }
    } catch (error) {
      if (live.current)
        setError(error instanceof Error ? error.message : "操作失败，请重试。");
    } finally {
      pending.current = false;
      if (live.current) setBusy(false);
    }
  };
  return {
    access,
    loading,
    busy,
    error,
    notice,
    refresh: () => run(getCollectorAccess),
    authorize: () =>
      run(authorizeCollector, "已启用。以后在此浏览器收藏，无需再次登录。"),
    revoke: (all = false) =>
      run(
        () => revokeCollector(all),
        all ? "已撤销此账号所有设备的收藏授权。" : "已关闭本设备免登录收藏。",
      ),
  };
}
