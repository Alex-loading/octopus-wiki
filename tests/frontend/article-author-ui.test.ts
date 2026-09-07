import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ArticleAuthorFields } from "../../src/app/components/ArticleAuthorFields.tsx";
import { OctopusAvatar } from "../../src/app/components/OctopusAvatar.tsx";
import { AUTHOR_AVATARS } from "../../src/app/content/articleAuthor.ts";

test("separate author pickers do not share radio groups or help ids", () => {
  const props = { name: "", avatarId: "everyday", darkMode: false, onNameChange: () => {}, onAvatarChange: () => {} };
  const html = renderToStaticMarkup(createElement("div", null,
    createElement(ArticleAuthorFields, props), createElement(ArticleAuthorFields, props)));
  const groups = [...html.matchAll(/type="radio" name="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(groups).size, 2);
  const descriptions = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(descriptions).size, 2);
});

test("author picker previews defaults and selected avatar in both themes", () => {
  for (const darkMode of [false, true]) {
    const html = renderToStaticMarkup(createElement(ArticleAuthorFields, {
      name: "", avatarId: "sleepy", darkMode, onNameChange: () => {}, onAvatarChange: () => {},
    }));
    assert.equal((html.match(/type="radio"/g) ?? []).length, 6);
    assert.equal((html.match(/checked=""/g) ?? []).length, 1);
    assert.match(html, /checked="" value="sleepy"/);
    assert.match(html, />Octopus<\/p>/);
    assert.match(html, /peer-focus-visible:ring-2/);
  }
});

test("author signature is escaped as text and does not acquire an automatic suffix", () => {
  const html = renderToStaticMarkup(createElement(ArticleAuthorFields, {
    name: "<script>hello</script>", avatarId: "everyday", darkMode: false,
    onNameChange: () => {}, onAvatarChange: () => {},
  }));
  assert.match(html, /&lt;script&gt;hello&lt;\/script&gt;<\/p>/);
  assert.doesNotMatch(html, /<script>/);
});

test("each avatar renders distinct local SVG artwork with an accessible name", () => {
  const images = AUTHOR_AVATARS.map(avatar => renderToStaticMarkup(createElement(OctopusAvatar, { avatarId: avatar.id })));
  assert.equal(new Set(images).size, 6);
  for (const html of images) {
    assert.match(html, /role="img" aria-label=".+章鱼头像"/);
    assert.match(html, /shape-rendering="crispEdges"/);
    assert.doesNotMatch(html, /https?:|<image/);
  }
});

test("the default octopus uses the site's indigo palette without changing the administrator artwork", () => {
  for (const avatarId of [undefined, "everyday", "unknown"]) {
    const html = renderToStaticMarkup(createElement(OctopusAvatar, { avatarId }));
    assert.match(html, /<rect width="32" height="32" fill="#EEF2FF"/);
    assert.match(html, /<g fill="#818CF8"/);
    assert.doesNotMatch(html, /#C57556|#F6EBDD|data-admin-crown/);
  }
  const admin = renderToStaticMarkup(createElement(OctopusAvatar, { avatarId: "focused", administrator: true }));
  assert.match(admin, /<g fill="#638B9C"/);
  assert.match(admin, /data-admin-crown="true"/);
});
