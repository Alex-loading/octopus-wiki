import assert from "node:assert/strict";
import test from "node:test";
import { safeAdminReturnPath } from "../../src/app/auth/adminSession";

test("管理员登录后可以返回照片管理", () => {
  assert.equal(safeAdminReturnPath("/admin/photos"), "/admin/photos");
});

test("发布时按编辑顺序保存照片，存储路径由记录和照片共同确定", async () => {
  const { photoEntryValues, photoPaths } = await import("../../src/app/content/photos");
  const entryId = crypto.randomUUID();
  const cover = { id: crypto.randomUUID(), width: 1200, height: 1800 };
  const detail = { id: crypto.randomUUID(), width: 1600, height: 1000 };
  const occurredAt = "2026-11-19T10:36:00.000Z";

  assert.deepEqual(photoEntryValues(" 雨后的校园\n ", occurredAt, [cover, detail], true), {
    caption: "雨后的校园",
    occurred_at: occurredAt,
    photos: [cover, detail],
    is_public: true,
  });
  assert.deepEqual(photoPaths(entryId, cover.id), {
    thumbnail: `${entryId}/${cover.id}/thumbnail.jpg`,
    full: `${entryId}/${cover.id}/full.jpg`,
  });
});

test("私密记录保留可见性，保存记录需要照片和有效的时间", async () => {
  const { photoEntryValues } = await import("../../src/app/content/photos");
  const occurredAt = "2026-11-19T10:36:00.000Z";
  const photo = { id: crypto.randomUUID(), width: 1024, height: 768 };
  assert.equal(photoEntryValues("周末", occurredAt, [photo], false).is_public, false);
  assert.throws(() => photoEntryValues("周末", occurredAt, [], true), /至少添加一张照片/);
  assert.throws(() => photoEntryValues("周末", occurredAt, [], false), /至少添加一张照片/);
  assert.throws(() => photoEntryValues("周末", "", [photo], false), /有效的记录时间/);
});
