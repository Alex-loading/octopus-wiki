import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Copy } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

const LANGUAGE_LABELS: Record<string, string> = {
  text: "纯文本", plaintext: "纯文本", plain: "纯文本",
  py: "Python", python: "Python",
  js: "JavaScript", javascript: "JavaScript", jsx: "JSX",
  ts: "TypeScript", typescript: "TypeScript", tsx: "TSX",
  java: "Java", c: "C", cpp: "C++", "c++": "C++",
  cs: "C#", csharp: "C#", "c#": "C#",
  go: "Go", rs: "Rust", rust: "Rust",
  rb: "Ruby", ruby: "Ruby", php: "PHP", swift: "Swift", kotlin: "Kotlin",
  json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML",
  html: "HTML", xml: "XML", css: "CSS", scss: "SCSS",
  sql: "SQL", graphql: "GraphQL", md: "Markdown", markdown: "Markdown",
  bash: "Bash", sh: "Shell", shell: "Shell", zsh: "Zsh",
  powershell: "PowerShell", docker: "Dockerfile", dockerfile: "Dockerfile",
};

export function ArticleCodeBlock({
  value,
  language,
  caption,
  dm,
}: {
  value: string;
  language: string;
  caption?: string;
  dm: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const copyResetTimer = useRef<number | null>(null);
  const normalizedLanguage = language.toLowerCase();
  const languageLabel = LANGUAGE_LABELS[normalizedLanguage] ?? language;
  const highlightLanguage = normalizedLanguage === "c++" ? "cpp"
    : normalizedLanguage === "c#" ? "csharp" : normalizedLanguage;

  useEffect(() => () => {
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    if (copyResetTimer.current !== null) window.clearTimeout(copyResetTimer.current);
    copyResetTimer.current = window.setTimeout(() => {
      setCopied(false);
      copyResetTimer.current = null;
    }, 1500);
  };

  return (
    <div className="group relative my-5 min-w-0">
      <details
        data-article-code-block="true"
        className={`group/code overflow-hidden rounded-xl border ${dm
          ? "border-white/10 bg-[#282c34]"
          : "border-gray-200 bg-[#fafafa]"}`}
      >
        <summary
          className={`flex h-12 cursor-pointer list-none items-center gap-2 whitespace-nowrap pl-3 pr-20 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400 [&::-webkit-details-marker]:hidden ${dm
            ? "text-gray-300 hover:bg-white/[0.04]"
            : "text-gray-600 hover:bg-gray-100/70"}`}
        >
          <ChevronRight
            data-code-toggle="true"
            size={15}
            aria-hidden="true"
            className="shrink-0 transition-transform group-open/code:rotate-90"
          />
          <span
            data-code-label="true"
            data-code-caption={caption ? "true" : undefined}
            title={caption || "代码块"}
            className="min-w-0 flex-1 truncate"
          >
            {caption || "代码块"}
          </span>
          <span
            data-code-language="true"
            title={languageLabel}
            className={`max-w-20 shrink-0 truncate font-mono text-xs font-medium ${dm ? "text-indigo-300" : "text-indigo-700"}`}
          >
            {languageLabel}
          </span>
          <span aria-hidden="true" className={`h-3 w-px shrink-0 ${dm ? "bg-white/15" : "bg-gray-300"}`} />
          <span data-code-line-count="true" className={`shrink-0 text-xs tabular-nums ${dm ? "text-gray-500" : "text-gray-400"}`}>
            {value ? value.split("\n").length : 0} 行
          </span>
        </summary>
        <div className={dm ? "border-t border-white/10" : "border-t border-gray-200"}>
          <SyntaxHighlighter
            language={highlightLanguage}
            style={dm ? oneDark : oneLight}
            customStyle={{
              margin: 0,
              padding: "0.75rem 1rem",
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
      </details>
      <button
        type="button"
        onClick={handleCopy}
        disabled={!value}
        className={`absolute top-0 right-0 inline-flex h-12 w-16 items-center justify-center gap-1 rounded-tr-xl text-xs transition-colors focus-visible:outline-2 focus-visible:outline-indigo-400 ${dm
          ? "text-gray-300 hover:bg-white/[0.04] hover:text-white"
          : "text-gray-500 hover:bg-gray-100/70 hover:text-gray-900"
          } disabled:cursor-not-allowed disabled:opacity-60`}
        aria-label={copied ? "代码已复制" : "复制代码"}
      >
        <span aria-hidden="true" className={`absolute left-0 h-3 w-px ${dm ? "bg-white/15" : "bg-gray-300"}`} />
        {copied ? <Check size={12} aria-hidden="true" /> : <Copy size={12} aria-hidden="true" />}
        {copied ? "已复制" : "复制"}
      </button>
    </div>
  );
}
