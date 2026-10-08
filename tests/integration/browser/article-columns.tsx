import React from "react";
import { createRoot } from "react-dom/client";
import { MarkdownRenderer } from "../../../src/app/components/MarkdownRenderer";
import "../../../src/styles/index.css";

const response = await fetch("/.debug/article-columns/content.json");
if (!response.ok) throw new Error("无法读取真实文章验证数据。");
const articles: { slug: string; markdown: string }[] = await response.json();
const dm = new URLSearchParams(location.search).get("theme") === "dark";
document.documentElement.classList.toggle("dark", dm);

createRoot(document.getElementById("root")!).render(
  <main className="mx-auto w-full max-w-3xl px-6 py-8">
    {articles.map((article) => (
      <article key={article.slug} data-article-slug={article.slug}>
        <MarkdownRenderer content={article.markdown} dm={dm} />
      </article>
    ))}
  </main>,
);
