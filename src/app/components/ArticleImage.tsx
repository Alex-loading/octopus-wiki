import React, { forwardRef, useState, type ImgHTMLAttributes } from "react";
import { losslessArticleImageSource } from "../content/articleImages";

export const ArticleImage = forwardRef<HTMLImageElement, ImgHTMLAttributes<HTMLImageElement>>(
  function ArticleImage({ src, onError, decoding = "async", ...props }, ref) {
    const optimizedSrc = losslessArticleImageSource(src);
    const [failedSource, setFailedSource] = useState<string>();
    const useOptimized = Boolean(optimizedSrc && optimizedSrc !== failedSource);
    const img = (
      <img
        {...props}
        ref={ref}
        src={src}
        decoding={decoding}
        onError={(event) => {
          if (useOptimized && event.currentTarget.currentSrc.includes("format=webp-lossless-v1")) {
            // A failed optimized request retries the original once, before showing
            // the caller's normal error state. A new source can optimize again.
            setFailedSource(optimizedSrc);
          } else {
            onError?.(event);
          }
        }}
      />
    );

    if (!optimizedSrc) return img;
    return (
      <picture className="contents">
        {useOptimized && <source type="image/webp" srcSet={optimizedSrc} />}
        {img}
      </picture>
    );
  },
);
