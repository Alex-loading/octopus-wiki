import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { optimizeFeishuImage } from "../../api/_lib/image-optimization.ts";
import { createFeishuMediaHandler } from "../../api/feishu-media.ts";
import { buildSignedMediaUrl } from "../../api/_lib/media-signature.ts";

const secret = "image-test-secret";
const originalUrl = `https://example.com${buildSignedMediaUrl("image", "image", secret)}`;
const optimizedUrl = `${originalUrl}&format=webp-lossless-v1`;

async function png() {
  // Transparent pixels intentionally contain colour data too.
  const pixels = Buffer.alloc(128 * 96 * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = (i / 4) % 256;
    pixels[i + 1] = 70;
    pixels[i + 2] = 130;
    pixels[i + 3] = i % 12 === 0 ? 0 : 255;
  }
  return sharp(pixels, { raw: { width: 128, height: 96, channels: 4 } })
    .png({ compressionLevel: 0 }).toBuffer();
}

function upstream(bytes: Uint8Array, type = "image/png") {
  return new Response(bytes, { headers: {
    "Content-Type": type,
    "Content-Length": String(bytes.length),
    "ETag": '"original"',
  } });
}

test("PNG becomes a smaller WebP with identical dimensions and RGBA pixels", async () => {
  const original = await png();
  const result = await optimizeFeishuImage(upstream(original));
  const output = Buffer.from(await result.arrayBuffer());
  assert.equal(result.headers.get("Content-Type"), "image/webp");
  assert.ok(output.length < original.length);
  assert.equal(Number(result.headers.get("Content-Length")), output.length);
  assert.notEqual(result.headers.get("ETag"), '"original"');
  const before = await sharp(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const after = await sharp(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(after.info.width, before.info.width);
  assert.equal(after.info.height, before.info.height);
  assert.deepEqual(after.data, before.data);
});

test("JPEGs, invalid, high-depth and colour-profiled PNGs retain the exact original bytes", async () => {
  const plain = await png();
  const cases = [
    [await sharp(plain).jpeg().toBuffer(), "image/jpeg"],
    [Buffer.from("invalid PNG"), "image/png"],
    [await sharp(plain).withIccProfile("p3").png().toBuffer(), "image/png"],
    [await sharp(plain).toColourspace("rgb16").png().toBuffer(), "image/png"],
  ] as const;
  for (const [bytes, type] of cases) {
    const response = await optimizeFeishuImage(upstream(bytes, type));
    assert.equal(response.headers.get("Content-Type"), type);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal(response.headers.get("ETag"), '"original"');
  }
});

test("images above the pixel budget bypass encoding without losing the source", async () => {
  const bytes = await sharp({ create: { width: 3000, height: 2100, channels: 3, background: "#5577bb" } }).png().toBuffer();
  const result = await optimizeFeishuImage(upstream(bytes));
  assert.equal(result.headers.get("Content-Type"), "image/png");
  assert.deepEqual(Buffer.from(await result.arrayBuffer()), bytes);
});

test("oversized images preserve streaming and all bytes even without Content-Length", async () => {
  const chunks = [new Uint8Array(3 * 1024 * 1024).fill(1), new Uint8Array(2 * 1024 * 1024).fill(2), new Uint8Array([3, 4])];
  for (const knownLength of [false, true]) {
    let position = 0;
    const headers = new Headers({ "Content-Type": "image/png" });
    if (knownLength) headers.set("Content-Length", String(chunks.reduce((sum, chunk) => sum + chunk.length, 0)));
    const response = new Response(new ReadableStream({
      pull(controller) {
        if (position === chunks.length) controller.close();
        else controller.enqueue(chunks[position++]);
      },
    }), { headers });
    const result = await optimizeFeishuImage(response);
    assert.equal(result.headers.get("Content-Type"), "image/png");
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), Buffer.concat(chunks));
  }
});

test("explicit image variants preserve signatures, original URLs, and independent cache entries", async () => {
  const original = await png();
  let downloads = 0;
  const handler = createFeishuMediaHandler({ secret, client: {
    downloadMedia: async () => { downloads++; return upstream(original); },
  } });
  const bad = await handler(new Request(optimizedUrl.replace("sig=", "sig=bad")));
  assert.equal(bad.status, 403);
  assert.equal(downloads, 0);

  const raw = await handler(new Request(originalUrl));
  assert.equal(raw.headers.get("Content-Type"), "image/png");
  assert.deepEqual(Buffer.from(await raw.arrayBuffer()), original);
  const optimized = await handler(new Request(optimizedUrl));
  assert.equal(optimized.headers.get("Content-Type"), "image/webp");
  assert.match(optimized.headers.get("Cache-Control")!, /max-age=3600/);
  assert.match(optimized.headers.get("Cache-Control")!, /s-maxage=86400/);
  assert.match(optimized.headers.get("Cache-Control")!, /stale-while-revalidate=604800/);
  // The representation is selected by URL, so CDN correctness does not depend on Vary: Accept.
  assert.equal(optimized.headers.get("Vary"), null);
});

test("unsupported transformations and attachment variants fail before downloading", async () => {
  const handler = createFeishuMediaHandler({ secret, client: {
    downloadMedia: async () => { throw new Error("must not download"); },
  } });
  const attachment = `https://example.com${buildSignedMediaUrl("file", "file", secret)}&format=webp-lossless-v1`;
  for (const url of [`${originalUrl}&format=jpeg`, attachment]) {
    const result = await handler(new Request(url));
    assert.equal(result.status, 400);
    assert.equal(result.headers.get("Cache-Control"), "no-store");
  }
});
