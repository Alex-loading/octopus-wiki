import React, { useState, type CSSProperties } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import {
  oneDark,
  oneLight,
} from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy, ImageOff } from "lucide-react";

const CALLOUT_CLASS_PATTERN = /^callout$/;
const CALLOUT_EMOJI_CLASS_PATTERN = /^callout-emoji$/;
const CALLOUT_BACKGROUND_CLASS_PATTERN = /^callout-bg-(?:[1-9]|1[0-4])$/;
const CALLOUT_BORDER_CLASS_PATTERN = /^callout-border-[1-7]$/;
const CALLOUT_TEXT_CLASS_PATTERN = /^callout-color-[1-7]$/;

const LIGHT_CALLOUT_BACKGROUNDS: Record<number, string> = {
  1: "#fef2f2",
  2: "#fff7ed",
  3: "#fefce8",
  4: "#f0fdf4",
  5: "#eff6ff",
  6: "#faf5ff",
  7: "#f9fafb",
  8: "#fecaca",
  9: "#fed7aa",
  10: "#fef08a",
  11: "#bbf7d0",
  12: "#bfdbfe",
  13: "#e9d5ff",
  14: "#e5e7eb",
};

const LIGHT_CALLOUT_BORDERS: Record<number, string> = {
  1: "#fecaca",
  2: "#fed7aa",
  3: "#fef08a",
  4: "#bbf7d0",
  5: "#bfdbfe",
  6: "#e9d5ff",
  7: "#e5e7eb",
};

const DARK_CALLOUT_BACKGROUNDS: Record<number, string> = {
  1: "rgba(248, 113, 113, 0.10)",
  2: "rgba(251, 146, 60, 0.10)",
  3: "rgba(250, 204, 21, 0.09)",
  4: "rgba(74, 222, 128, 0.09)",
  5: "rgba(96, 165, 250, 0.10)",
  6: "rgba(192, 132, 252, 0.10)",
  7: "rgba(255, 255, 255, 0.045)",
  8: "rgba(248, 113, 113, 0.16)",
  9: "rgba(251, 146, 60, 0.16)",
  10: "rgba(250, 204, 21, 0.14)",
  11: "rgba(74, 222, 128, 0.14)",
  12: "rgba(96, 165, 250, 0.16)",
  13: "rgba(192, 132, 252, 0.16)",
  14: "rgba(255, 255, 255, 0.08)",
};

const DARK_CALLOUT_BORDERS: Record<number, string> = {
  1: "rgba(248, 113, 113, 0.26)",
  2: "rgba(251, 146, 60, 0.26)",
  3: "rgba(250, 204, 21, 0.24)",
  4: "rgba(74, 222, 128, 0.24)",
  5: "rgba(96, 165, 250, 0.26)",
  6: "rgba(192, 132, 252, 0.26)",
  7: "rgba(255, 255, 255, 0.12)",
};

const markdownSanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    h1: [...(defaultSchema.attributes?.h1 ?? []), "id"],
    h2: [...(defaultSchema.attributes?.h2 ?? []), "id"],
    h3: [...(defaultSchema.attributes?.h3 ?? []), "id"],
    a: [
      ...(defaultSchema.attributes?.a ?? []),
      "id",
      "className",
      "ariaLabel",
      "ariaHidden",
      "tabIndex",
    ],
    code: [...(defaultSchema.attributes?.code ?? []), "className"],
    pre: [...(defaultSchema.attributes?.pre ?? []), "className"],
    span: [...(defaultSchema.attributes?.span ?? []), "className"],
    div: [
      ...(defaultSchema.attributes?.div ?? []),
      [
        "className",
        CALLOUT_CLASS_PATTERN,
        CALLOUT_EMOJI_CLASS_PATTERN,
        CALLOUT_BACKGROUND_CLASS_PATTERN,
        CALLOUT_BORDER_CLASS_PATTERN,
        CALLOUT_TEXT_CLASS_PATTERN,
      ],
    ],
    th: [...(defaultSchema.attributes?.th ?? []), "align"],
    td: [...(defaultSchema.attributes?.td ?? []), "align"],
    input: [
      ...(defaultSchema.attributes?.input ?? []),
      "type",
      "checked",
      "disabled",
    ],
  },
};

function classColorIndex(className: string | undefined, prefix: string): number | null {
  const token = className?.split(/\s+/).find((item) => item.startsWith(prefix));
  if (!token) return null;
  const value = Number(token.slice(prefix.length));
  return Number.isInteger(value) ? value : null;
}

function calloutStyle(className: string | undefined, dm: boolean): CSSProperties {
  const backgroundIndex = classColorIndex(className, "callout-bg-");
  const borderIndex = classColorIndex(className, "callout-border-");

  return {
    backgroundColor: backgroundIndex === null
      ? (dm ? "rgba(255, 255, 255, 0.045)" : "#f9fafb")
      : (dm ? DARK_CALLOUT_BACKGROUNDS : LIGHT_CALLOUT_BACKGROUNDS)[backgroundIndex],
    borderColor: borderIndex === null
      ? (dm ? "rgba(255, 255, 255, 0.12)" : "#e5e7eb")
      : (dm ? DARK_CALLOUT_BORDERS : LIGHT_CALLOUT_BORDERS)[borderIndex],
  };
}

function MarkdownImage({
  src,
  alt,
  title,
  dm,
}: {
  src?: string;
  alt?: string;
  title?: string;
  dm: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        data-article-image-fallback="true"
        role="img"
        aria-label={alt || "图片加载失败"}
        className={`my-6 flex min-h-28 w-full items-center justify-center gap-2 rounded-xl border text-sm ${dm
          ? "border-white/10 bg-white/[0.03] text-gray-500"
          : "border-gray-200 bg-gray-50 text-gray-400"
          }`}
      >
        <ImageOff size={17} aria-hidden="true" />
        图片暂时无法加载
      </span>
    );
  }

  return (
    <span className="my-6 block overflow-hidden rounded-xl">
      <img
        data-article-image="true"
        src={src}
        alt={alt ?? ""}
        title={title}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`mx-auto h-auto max-h-[72vh] max-w-full rounded-xl border object-contain ${dm
          ? "border-white/10 bg-white/[0.03]"
          : "border-gray-200 bg-gray-50"
          }`}
      />
    </span>
  );
}

export function MarkdownRenderer({
  content,
  dm,
}: {
  content: string;
  dm: boolean;
}) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyCode = async (rawCode: string) => {
    if (!rawCode) return;
    try {
      await navigator.clipboard.writeText(rawCode);
      setCopiedCode(rawCode);
      window.setTimeout(() => setCopiedCode((prev) => (prev === rawCode ? null : prev)), 1500);
    } catch {
      setCopiedCode(null);
    }
  };

  const components: Components = {
    h2: ({ children, ...props }) => (
      <h2
        {...props}
        className={`text-xl font-medium mt-10 mb-4 scroll-mt-28 leading-snug ${dm ? "text-white" : "text-gray-900"
          } [&_.heading-anchor]:ml-2 [&_.heading-anchor]:opacity-0 [&_.heading-anchor]:transition-opacity hover:[&_.heading-anchor]:opacity-100`}
      >
        {children}
      </h2>
    ),
    h3: ({ children, ...props }) => (
      <h3
        {...props}
        className={`text-lg font-medium mt-7 mb-3 scroll-mt-28 leading-snug ${dm ? "text-gray-100" : "text-gray-900"
          } [&_.heading-anchor]:ml-2 [&_.heading-anchor]:opacity-0 [&_.heading-anchor]:transition-opacity hover:[&_.heading-anchor]:opacity-100`}
      >
        {children}
      </h3>
    ),
    p: ({ children, ...props }) => (
      <p
        {...props}
        className={`my-4 text-base leading-8 ${dm ? "text-gray-300" : "text-gray-600"}`}
      >
        {children}
      </p>
    ),
    ul: ({ children, ...props }) => (
      <ul
        {...props}
        className={`my-4 ml-6 list-disc space-y-2 ${dm ? "text-gray-300" : "text-gray-600"}`}
      >
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol
        {...props}
        className={`my-4 ml-6 list-decimal space-y-2 ${dm ? "text-gray-300" : "text-gray-600"}`}
      >
        {children}
      </ol>
    ),
    li: ({ children, ...props }) => (
      <li {...props} className="leading-8">
        {children}
      </li>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote
        {...props}
        className={`my-5 border-l-2 pl-4 italic ${dm
          ? "border-indigo-400/40 text-gray-300"
          : "border-indigo-300 text-gray-600"
          }`}
      >
        {children}
      </blockquote>
    ),
    hr: (props) => (
      <hr
        {...props}
        className={`my-8 border-0 h-px ${dm ? "bg-white/10" : "bg-gray-200"}`}
      />
    ),
    a: ({ href, children, ...props }) => {
      const isFragment = href?.startsWith("#");
      return (
        <a
          {...props}
          href={href}
          target={isFragment ? undefined : "_blank"}
          rel={isFragment ? undefined : "noreferrer noopener"}
          className={`${dm
            ? "text-indigo-300 hover:text-indigo-200"
            : "text-indigo-700 hover:text-indigo-600"
            } underline underline-offset-2 decoration-indigo-400/60`}
        >
          {children}
        </a>
      );
    },
    div: ({ className, children, ...props }) => {
      const classNames = className?.split(/\s+/) ?? [];

      if (classNames.includes("callout-emoji")) {
        return (
          <span
            className={`feishu-callout-emoji mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border text-lg shadow-sm ${dm
              ? "border-white/10 bg-white/[0.07]"
              : "border-white/80 bg-white/85"
              }`}
            aria-hidden="true"
          >
            {children}
          </span>
        );
      }

      if (classNames.includes("callout")) {
        return (
          <aside
            {...props}
            data-feishu-callout="true"
            aria-label="高亮内容"
            style={calloutStyle(className, dm)}
            className={`my-6 grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 rounded-2xl border px-5 py-4 shadow-[0_12px_32px_-28px_rgba(15,23,42,0.45)] md:px-6 md:py-5 ${dm
              ? "text-gray-300"
              : "text-gray-700"
              } [&>p]:col-start-2 [&>p]:!my-0 [&>p+p]:!mt-1 [&>ul]:col-start-2 [&>ul]:!my-0 [&>ol]:col-start-2 [&>ol]:!my-0`}
          >
            {children}
          </aside>
        );
      }

      return <div {...props}>{children}</div>;
    },
    img: ({ src, alt, title }) => (
      <MarkdownImage src={src} alt={alt} title={title} dm={dm} />
    ),
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children, ...props }) => {
      const value = String(children ?? "").replace(/\n$/, "");
      const isInlineCode = !className && !value.includes("\n");

      if (isInlineCode) {
        return (
          <code
            {...props}
            className={`px-1.5 py-0.5 rounded text-sm font-mono ${dm
              ? "bg-white/10 text-indigo-300"
              : "bg-gray-100 text-indigo-700"
              }`}
          >
            {children}
          </code>
        );
      }

      const language = /language-([\w-]+)/.exec(className ?? "")?.[1] ?? "text";
      const copied = copiedCode === value;

      return (
        <div className="group relative my-5">
          <button
            type="button"
            onClick={() => handleCopyCode(value)}
            disabled={!value}
            className={`absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-all duration-150 ${copied
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
              } ${dm
                ? "border-white/10 bg-gray-800/90 text-gray-300 hover:text-white"
                : "border-gray-200 bg-white/90 text-gray-500 hover:text-gray-900"
              } ${!value ? "cursor-not-allowed opacity-60" : ""}`}
            aria-label={copied ? "代码已复制" : "复制代码"}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "已复制" : "复制"}
          </button>
          <SyntaxHighlighter
            {...props}
            language={language}
            style={dm ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              borderRadius: "0.75rem",
              border: dm ? "1px solid rgba(255,255,255,0.1)" : "1px solid rgb(229,231,235)",
              paddingTop: "0.75rem",
              paddingBottom: "0.75rem",
              paddingLeft: "1rem",
              paddingRight: "1rem",
              fontSize: "0.875rem",
              lineHeight: "1.5rem",
              overflowX: "auto",
            }}
            codeTagProps={{ className: "font-mono" }}
            PreTag="div"
          >
            {value}
          </SyntaxHighlighter>
        </div>
      );
    },
    table: ({ children, ...props }) => (
      <div className="my-6 overflow-x-auto">
        <table
          {...props}
          className={`w-full border-collapse text-sm ${dm ? "text-gray-300" : "text-gray-600"}`}
        >
          {children}
        </table>
      </div>
    ),
    thead: ({ children, ...props }) => (
      <thead
        {...props}
        className={dm ? "bg-white/5 text-gray-100" : "bg-gray-50 text-gray-900"}
      >
        {children}
      </thead>
    ),
    th: ({ children, ...props }) => (
      <th
        {...props}
        className={`border px-3 py-2 text-left font-medium ${dm ? "border-white/10" : "border-gray-200"}`}
      >
        {children}
      </th>
    ),
    td: ({ children, ...props }) => (
      <td
        {...props}
        className={`border px-3 py-2 align-top ${dm ? "border-white/10" : "border-gray-200"}`}
      >
        {children}
      </td>
    ),
    input: ({ type, checked, ...props }) => {
      if (type !== "checkbox") return <input type={type} checked={checked} {...props} />;

      return (
        <input
          {...props}
          type="checkbox"
          checked={checked}
          disabled
          className={`mr-2 align-middle rounded-sm ${dm
            ? "border-white/20 bg-white/10 accent-indigo-400"
            : "border-gray-300 bg-white accent-indigo-600"
            }`}
        />
      );
    },
    strong: ({ children, ...props }) => (
      <strong {...props} className={dm ? "text-white font-medium" : "text-gray-900 font-medium"}>
        {children}
      </strong>
    ),
    del: ({ children, ...props }) => (
      <del {...props} className={dm ? "text-gray-500" : "text-gray-400"}>
        {children}
      </del>
    ),
  };

  return (
    <div className="text-base">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          rehypeSlug,
          [rehypeAutolinkHeadings, {
            behavior: "append",
            properties: {
              className: ["heading-anchor"],
              ariaLabel: "标题锚点",
            },
          }],
          [rehypeSanitize, markdownSanitizeSchema],
        ]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
