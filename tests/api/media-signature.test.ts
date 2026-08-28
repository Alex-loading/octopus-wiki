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
