import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";

import { optimizeFeishuImage } from "../../api/_lib/image-optimization.ts";
import { trimFeishuWhiteboard } from "../../api/_lib/whiteboard-image.ts";

const original = readFileSync(new URL("../fixtures/feishu-langchain-whiteboard.jpg", import.meta.url));
const contentRegion = { left: 408, top: 16, width: 1722, height: 560 };

function imageResponse(bytes: Buffer, contentType: string): Response {
  return new Response(new Uint8Array(bytes), { headers: {
    "Content-Type": contentType,
    "Content-Length": String(bytes.length),
    "ETag": `"${createHash("sha256").update(bytes).digest("hex")}"`,
  } });
}

async function assertContent(bytes: Buffer, expected: Buffer, width: number, height: number): Promise<void> {
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, width + 48);
  assert.equal(metadata.height, height + 48);
  const content = await sharp(bytes).removeAlpha()
    .extract({ left: 24, top: 24, width, height }).raw().toBuffer();
  assert.deepEqual(content, expected);

  const borders = [
    { left: 0, top: 0, width: width + 48, height: 24 },
    { left: 0, top: height + 24, width: width + 48, height: 24 },
    { left: 0, top: 24, width: 24, height },
    { left: width + 24, top: 24, width: 24, height },
  ];
  for (const region of borders) {
    const border = await sharp(bytes).removeAlpha().extract(region).raw().toBuffer();
    assert.ok(border.every((value) => value === 255));
  }
}

test("真实画板根据内容裁剪并保留完整文字、连线和四周边距", async () => {
  const before = await sharp(original).metadata();
  assert.equal(before.width, 2560);
  assert.equal(before.height, 2560);
  const expected = await sharp(original).extract(contentRegion).raw().toBuffer();
  const source = imageResponse(original, "image/jpeg");
  const sourceEtag = source.headers.get("ETag");
  const response = await trimFeishuWhiteboard(source);
  const output = Buffer.from(await response.arrayBuffer());

  assert.equal(response.headers.get("Content-Type"), "image/png");
  assert.equal(Number(response.headers.get("Content-Length")), output.length);
  assert.equal(response.headers.get("ETag"), `"${createHash("sha256").update(output).digest("hex")}"`);
  assert.notEqual(response.headers.get("ETag"), sourceEtag);
  await assertContent(output, expected, 1722, 560);
});

test("不同画布尺寸的横向内容使用相同内容范围", async () => {
  const input = await sharp(original)
    .extend({ left: 320, right: 640, top: 80, bottom: 160, background: "#ffffff" })
    .png().toBuffer();
  const before = await sharp(input).metadata();
  assert.equal(before.width, 3520);
  assert.equal(before.height, 2800);
  const expected = await sharp(original).extract(contentRegion).raw().toBuffer();
  const response = await trimFeishuWhiteboard(imageResponse(input, "image/png"));
  await assertContent(Buffer.from(await response.arrayBuffer()), expected, 1722, 560);
});

test("纵向画板按照纵向内容范围确定长宽比例", async () => {
  const rotated = await sharp(original).rotate(90).png().toBuffer();
  const input = await sharp(rotated)
    .extend({ left: 80, right: 80, top: 720, bottom: 880, background: "#ffffff" })
    .png().toBuffer();
  const before = await sharp(input).metadata();
  assert.equal(before.width, 2720);
  assert.equal(before.height, 4160);
  const originalContent = await sharp(original).extract(contentRegion).png().toBuffer();
  const expected = await sharp(originalContent).rotate(90).raw().toBuffer();
  const response = await trimFeishuWhiteboard(imageResponse(input, "image/png"));
  await assertContent(Buffer.from(await response.arrayBuffer()), expected, 560, 1722);
});

test("内容接近画布边缘时四周仍然保留完整边距", async () => {
  const input = await sharp(original).extract(contentRegion).png().toBuffer();
  const expected = await sharp(input).raw().toBuffer();
  const response = await trimFeishuWhiteboard(imageResponse(input, "image/png"));
  await assertContent(Buffer.from(await response.arrayBuffer()), expected, 1722, 560);
});

test("PNG 画板外围的透明区域按可见内容裁剪", async () => {
  const input = await sharp(original).ensureAlpha()
    .extend({ left: 160, right: 320, top: 80, bottom: 120, background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png().toBuffer();
  const expected = await sharp(original).extract(contentRegion).raw().toBuffer();
  const response = await trimFeishuWhiteboard(imageResponse(input, "image/png"));
  await assertContent(Buffer.from(await response.arrayBuffer()), expected, 1722, 560);
});

test("WebP 转换保留裁剪后的内容范围和全部像素", async () => {
  const trimmed = await trimFeishuWhiteboard(imageResponse(original, "image/jpeg"));
  const response = await optimizeFeishuImage(trimmed);
  assert.equal(response.headers.get("Content-Type"), "image/webp");
  const expected = await sharp(original).extract(contentRegion).raw().toBuffer();
  await assertContent(Buffer.from(await response.arrayBuffer()), expected, 1722, 560);
});

test("不完整的画板图片在解码位置报错", async () => {
  await assert.rejects(trimFeishuWhiteboard(imageResponse(original.subarray(0, 32), "image/jpeg")));
});
