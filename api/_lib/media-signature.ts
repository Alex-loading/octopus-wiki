import { createHmac, timingSafeEqual } from "node:crypto";

export type FeishuMediaType = "image" | "file" | "board";

const MEDIA_TYPES = new Set<FeishuMediaType>(["image", "file", "board"]);

export function isFeishuMediaType(value: string): value is FeishuMediaType {
  return MEDIA_TYPES.has(value as FeishuMediaType);
}

function assertSigningInput(token: string, type: FeishuMediaType, secret: string): void {
  if (!token.trim() || !isFeishuMediaType(type) || !secret) {
    throw new Error("Invalid media signing input");
  }
}

export function signMediaRequest(
  token: string,
  type: FeishuMediaType,
  secret: string,
): string {
  assertSigningInput(token, type, secret);
  return createHmac("sha256", secret).update(`${type}\n${token}`).digest("hex");
}

export function verifyMediaRequest(
  token: string,
  type: string,
  signature: string,
  secret: string,
): boolean {
  if (!token.trim() || !isFeishuMediaType(type) || !secret || !/^[a-f0-9]{64}$/.test(signature)) {
    return false;
  }

  const expected = Buffer.from(signMediaRequest(token, type, secret), "hex");
  const provided = Buffer.from(signature, "hex");
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}

export function buildSignedMediaUrl(
  token: string,
  type: FeishuMediaType,
  secret: string,
): string {
  const params = new URLSearchParams({
    token,
    type,
    sig: signMediaRequest(token, type, secret),
  });
  return `/api/feishu-media?${params.toString()}`;
}
