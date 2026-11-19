import { useEffect, useRef, useState, type CSSProperties } from "react";
import { downloadPhoto } from "../content/photoRepository";

type ImageResult = { source: Blob | string; url: string };

export function PhotoImage({ source, alt, lazy = false, style }: {
  source: Blob | string;
  alt: string;
  lazy?: boolean;
  style?: CSSProperties;
}) {
  const target = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(!lazy);
  const [result, setResult] = useState<ImageResult>();

  useEffect(() => {
    if (visible || !target.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: "160px" });
    observer.observe(target.current);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    let url = "";
    const image = typeof source === "string" ? downloadPhoto(source, controller.signal) : Promise.resolve(source);
    void image.then(blob => {
      if (controller.signal.aborted) return;
      url = URL.createObjectURL(blob);
      setResult({ source, url });
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ source, url: "" });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [source, visible]);

  const current = result?.source === source ? result : undefined;
  return (
    <span className="photo-image" ref={target} style={style}>
      {current && (current.url
        ? <img src={current.url} alt={alt} decoding="async" onError={() => setResult({ source, url: "" })} />
        : <span className="photo-image-error">照片加载失败</span>)}
    </span>
  );
}
