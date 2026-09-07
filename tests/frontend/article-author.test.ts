import assert from "node:assert/strict";
import test from "node:test";
import * as author from "../../src/app/content/articleAuthor.ts";

test("blank and legacy authors use the Octopus identity", () => {
  assert.equal(author.resolveAuthorName(), "Octopus");
  assert.equal(author.resolveAuthorName("  "), "Octopus");
  assert.equal(author.resolveAuthorName("  刚睡醒的 Octopus  "), "刚睡醒的 Octopus");
});

test("six built-in avatars have unique ids and invalid ids fall back safely", () => {
  assert.equal(author.AUTHOR_AVATARS.length, 6);
  assert.equal(new Set(author.AUTHOR_AVATARS.map(a => a.id)).size, 6);
  assert.equal(author.resolveAuthorAvatar().id, "everyday");
  assert.equal(author.resolveAuthorAvatar("unknown").id, "everyday");
  for (const avatar of author.AUTHOR_AVATARS) {
    assert.equal(author.resolveAuthorAvatar(avatar.id), avatar);
  }
});
