import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleImage } from "../../src/app/components/ArticleImage.tsx";
import { losslessArticleImageSource } from "../../src/app/content/articleImages.ts";

const original = "/api/feishu-media?token=image-token&type=image&sig=signature";

test("only signed local Feishu images get a stable lossless variant", () => {
  const optimized = losslessArticleImageSource(original)!;
  assert.equal(new URL(optimized, "https://example.com").searchParams.get("format"), "webp-lossless-v1");
  assert.equal(losslessArticleImageSource(optimized), optimized);
  assert.ok(losslessArticleImageSource(original.replace("type=image", "type=board")));
  for (const src of [undefined, "https://example.com/image.png", `https://other.com${original}`,
    original.replace("type=image", "type=file"), "/api/feishu-media?type=image", "data:image/png;base64,AA"]) {
    assert.equal(losslessArticleImageSource(src), undefined);
  }
});

test("picture offers WebP while retaining the original img and layout/loading attributes", () => {
  const html = renderToStaticMarkup(createElement(ArticleImage, {
    src: original, alt: "封面", loading: "lazy", width: 112, height: 96, className: "object-cover",
  }));
  assert.match(html, /<picture class="contents">/);
  assert.match(html, /<source type="image\/webp" srcSet="[^"]+format=webp-lossless-v1"/);
  assert.match(html, /<img[^>]+src="\/api\/feishu-media\?token=image-token&amp;type=image&amp;sig=signature"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /width="112" height="96"/);
  assert.match(html, /decoding="async"/);
});

test("external images keep their original URL without a picture wrapper", () => {
  const html = renderToStaticMarkup(createElement(ArticleImage, { src: "https://images.example.com/a.jpg", alt: "photo" }));
  assert.doesNotMatch(html, /picture|source|format=/);
  assert.match(html, /src="https:\/\/images.example.com\/a.jpg"/);
});
