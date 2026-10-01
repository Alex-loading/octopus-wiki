import { createHash } from "node:crypto";
import sharp from "sharp";

const WHITEBOARD_PADDING = 24;

export async function trimFeishuWhiteboard(upstream: Response): Promise<Response> {
  const original = Buffer.from(await upstream.arrayBuffer());
  const { data, info } = await sharp(original, { failOn: "warning" })
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = await sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  })
    .trim({ background: "#ffffff", threshold: 10, lineArt: true })
    .extend({
      top: WHITEBOARD_PADDING,
      bottom: WHITEBOARD_PADDING,
      left: WHITEBOARD_PADDING,
      right: WHITEBOARD_PADDING,
      background: "#ffffff",
    })
    .png()
    .toBuffer();

  const headers = new Headers(upstream.headers);
  headers.set("Content-Type", "image/png");
  headers.set("Content-Length", String(output.length));
  headers.set("ETag", `"${createHash("sha256").update(output).digest("hex")}"`);
  headers.delete("Content-Encoding");
  return new Response(new Uint8Array(output), { headers });
}
