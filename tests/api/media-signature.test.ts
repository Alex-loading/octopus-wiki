import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSignedMediaUrl,
  signMediaRequest,
  verifyMediaRequest,
} from "../../api/_lib/media-signature.ts";

const secret = "test-signing-secret";

test("creates deterministic signatures and same-origin media URLs", () => {
  const signature = signMediaRequest("image-token", "image", secret);
  assert.equal(signature, signMediaRequest("image-token", "image", secret));
  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.equal(
    buildSignedMediaUrl("image-token", "image", secret),
    `/api/feishu-media?token=image-token&type=image&sig=${signature}`,
  );
});

test("rejects tampering and unsupported media types", () => {
  const signature = signMediaRequest("file-token", "file", secret);
  assert.equal(verifyMediaRequest("file-token", "file", signature, secret), true);
  assert.equal(verifyMediaRequest("changed", "file", signature, secret), false);
  assert.equal(verifyMediaRequest("file-token", "image", signature, secret), false);
  assert.equal(verifyMediaRequest("file-token", "file", "short", secret), false);
  assert.throws(() => signMediaRequest("token", "video" as never, secret));
});

test("画板资源地址包含裁剪版本并保留有效签名", () => {
  const url = new URL(buildSignedMediaUrl("board-token", "board", secret), "https://example.com");
  assert.equal(url.searchParams.get("v"), "board-trim-v1");
  assert.equal(verifyMediaRequest("board-token", "board", url.searchParams.get("sig")!, secret), true);
  for (const type of ["image", "file"] as const) {
    const mediaUrl = new URL(buildSignedMediaUrl("media-token", type, secret), "https://example.com");
    assert.equal(mediaUrl.searchParams.has("v"), false);
  }
});
