import React, { useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ArticleImage } from "./ArticleImage";

export function ArticleImageViewer({
  src,
  alt,
  title,
  children,
}: {
  src: string;
  alt?: string;
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const label = title || alt;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          data-article-image-trigger="true"
          aria-label={label ? `浏览图片：${label}` : "浏览图片"}
          className="mx-auto block max-w-full cursor-zoom-in rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-500"
        >
          {children}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[300] bg-gray-950/90 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed inset-0 z-[301] flex h-dvh items-center justify-center px-4 pt-20 pb-12 outline-none"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <Dialog.Title className="sr-only">{label || "图片浏览"}</Dialog.Title>
          <Dialog.Description className="sr-only">
            按 Esc 或点击背景关闭图片浏览。
          </Dialog.Description>
          <Dialog.Close
            aria-label="关闭图片浏览"
            className="absolute top-4 right-4 flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
          >
            <X size={22} aria-hidden="true" />
          </Dialog.Close>
          <ArticleImage
            src={src}
            alt={alt ?? ""}
            title={title}
            loading="eager"
            className="h-auto max-h-[calc(100dvh-8rem)] w-auto max-w-full rounded object-contain"
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
