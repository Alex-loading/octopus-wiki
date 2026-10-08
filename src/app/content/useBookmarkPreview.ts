import { useEffect, useRef, useState } from "react";
import {
  BookmarkPreviewError, needsBookmarkInteraction, type BookmarkLoginSession,
  type BookmarkMetadata, type BookmarkPreviewActions,
} from "./bookmarkPreview";

function waitForCheck(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 4000);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export function useBookmarkPreview(actions: BookmarkPreviewActions,
  onRecovered: (url: string, metadata: BookmarkMetadata) => void) {
  const [problem, setProblem] = useState<{ url: string; error: BookmarkPreviewError } | null>(null);
  const [session, setSession] = useState<BookmarkLoginSession | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState("");
  const operation = useRef<AbortController | undefined>(undefined);
  const sessionId = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const recoveringNow = useRef(false);
  const currentActions = useRef(actions);
  const recovered = useRef(onRecovered);
  currentActions.current = actions;
  recovered.current = onRecovered;

  const release = async (id?: string) => {
    if (id) await currentActions.current.cancelLogin(id);
  };
  const stop = () => {
    generation.current++;
    recoveringNow.current = false;
    operation.current?.abort();
    operation.current = undefined;
    const id = sessionId.current;
    sessionId.current = undefined;
    return release(id);
  };
  const cancel = () => {
    const stopped = stop();
    const version = generation.current;
    setSession(null);
    setRecovering(false);
    setProblem(null);
    setMessage("");
    void stopped.catch(error => {
      if (generation.current === version) setMessage(error instanceof Error ? error.message : "结束登录等待失败。");
    });
  };
  useEffect(() => () => {
    void stop().catch(error => console.error("结束登录等待失败", error));
  }, []);

  const preview = async (url: string) => {
    const stopped = stop();
    const controller = new AbortController();
    operation.current = controller;
    setProblem(null);
    setMessage("");
    try {
      await stopped;
      controller.signal.throwIfAborted();
      const metadata = await currentActions.current.preview(url, controller.signal);
      controller.signal.throwIfAborted();
      return metadata;
    } catch (error) {
      controller.signal.throwIfAborted();
      if (!controller.signal.aborted && needsBookmarkInteraction(error)) setProblem({ url, error });
      throw error;
    }
  };

  const recover = async () => {
    if (!problem || recoveringNow.current) return;
    const stopped = stop();
    recoveringNow.current = true;
    const controller = new AbortController();
    operation.current = controller;
    const id = crypto.randomUUID();
    sessionId.current = id;
    setRecovering(true);
    setMessage("正在打开平台页面…");
    try {
      await stopped;
      controller.signal.throwIfAborted();
      const opened = await currentActions.current.startLogin(problem.url, id, controller.signal);
      controller.signal.throwIfAborted();
      setSession(opened);
      setMessage("请在打开的平台页面完成登录或验证。完成后将自动读取原链接，最多等待 10 分钟。");
      const remaining = Math.max(0, opened.expiresAt - Date.now());
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(remaining)]);
      while (true) {
        signal.throwIfAborted();
        const result = await currentActions.current.checkLogin(opened.id, signal);
        signal.throwIfAborted();
        if (result.status === "ready") {
          recovered.current(problem.url, result.metadata);
          setProblem(null);
          setMessage("已重新读取原链接，内容信息已更新。");
          return;
        }
        await waitForCheck(signal);
      }
    } catch (error) {
      if (!controller.signal.aborted)
        setMessage(error instanceof Error && error.name !== "TimeoutError"
          ? error.message : "登录等待已结束，可以重新打开平台页面。");
    } finally {
      try { await release(id); }
      catch (error) { console.error("结束登录等待失败", error); }
      if (operation.current === controller) {
        recoveringNow.current = false;
        sessionId.current = undefined;
        setSession(null);
        setRecovering(false);
      }
    }
  };

  return { preview, problem, session, recovering, message, recover, cancel };
}
