import { createHash } from "node:crypto";

const MAX_INPUT_BYTES = 4 * 1024 * 1024;
const MAX_INPUT_PIXELS = 6_000_000;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const SRGB_CHROMATICITIES = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000];

// WebP is 8-bit. Keep animation, EXIF orientation and non-sRGB colour handling
// on the original path instead of risking a change in browser rendering.
function isPlainSrgbPng(input: Buffer): boolean {
  if (!input.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  let hasHeader = false;
  for (let offset = 8; offset + 12 <= input.length;) {
    const length = input.readUInt32BE(offset);
    const name = input.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    if (start + length + 4 > input.length) return false;
    if (name === "IHDR") {
      if (length !== 13 || input[start + 8] !== 8 || ![2, 6].includes(input[start + 9])) return false;
      hasHeader = true;
    }
    if (["acTL", "iCCP", "eXIf", "cICP", "mDCV", "cLLI"].includes(name)) return false;
    if (name === "gAMA" && (length !== 4 || input.readUInt32BE(start) !== 45455)) return false;
    if (name === "cHRM" && (length !== 32 || SRGB_CHROMATICITIES.some((value, i) => input.readUInt32BE(start + i * 4) !== value))) return false;
    if (name === "IEND") return hasHeader;
    offset = start + length + 4;
  }
  return false;
}

// Read at most the conversion budget. If an unbounded/chunked response is too
// large, replay the consumed chunks and continue the original stream.
async function readSmallImage(upstream: Response): Promise<Buffer | Response> {
  const reader = upstream.body!.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) {
      reader.releaseLock();
      return Buffer.concat(chunks, size);
    }
    chunks.push(next.value);
    size += next.value.byteLength;
    if (size > MAX_INPUT_BYTES) {
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(chunk);
        },
        async pull(controller) {
          try {
            const remaining = await reader.read();
            if (remaining.done) { reader.releaseLock(); controller.close(); }
            else controller.enqueue(remaining.value);
          } catch (error) { controller.error(error); }
        },
        cancel(reason) { return reader.cancel(reason); },
      }), { headers: upstream.headers });
    }
  }
}

export async function optimizeFeishuImage(upstream: Response): Promise<Response> {
  const mime = upstream.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase();
  if (mime !== "image/png" || !upstream.body || Number(upstream.headers.get("Content-Length")) > MAX_INPUT_BYTES) {
    return upstream;
  }

  const original = await readSmallImage(upstream);
  if (original instanceof Response) return original;
  const fallback = () => new Response(new Uint8Array(original), { headers: upstream.headers });
  if (!isPlainSrgbPng(original)) return fallback();

  try {
    const { default: sharp } = await import("sharp");
    const decode = (input: Buffer) => sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "warning" }).timeout({ seconds: 3 });
    const source = decode(original);
    const metadata = await source.metadata();
    if (metadata.depth !== "uchar" || metadata.space !== "srgb" || (metadata.pages ?? 1) !== 1) return fallback();

    const output = await source.clone().webp({ lossless: true, exact: true, effort: 4 }).toBuffer();
    if (output.length >= original.length) return fallback();

    // Compare decoded RGBA, including invisible RGB values under transparency.
    const before = await decode(original).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const after = await decode(output).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (before.info.width !== after.info.width || before.info.height !== after.info.height || !before.data.equals(after.data)) {
      return fallback();
    }

    const headers = new Headers(upstream.headers);
    headers.set("Content-Type", "image/webp");
    headers.set("Content-Length", String(output.length));
    headers.set("ETag", `"${createHash("sha256").update(output).digest("hex")}"`);
    headers.delete("Content-Encoding");
    return new Response(new Uint8Array(output), { headers });
  } catch {
    // Unsupported images and encoder failures must not break article images.
    return fallback();
  }
}
