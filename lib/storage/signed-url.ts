import { createHmac, timingSafeEqual } from "node:crypto";
import { derivedKey } from "@/lib/crypto/hkdf";

type TokenPayload = { id: string; exp: number; sub: string };

function mac(body: string): string {
  return createHmac("sha256", derivedKey("doc-token")).update(body).digest("base64url");
}

export function signDocumentAccess(id: string, ttlSeconds = 300, now = Date.now(), sub?: string): string {
  if (!sub) throw new Error("Document access tokens require a signer.");
  const payload: TokenPayload = {
    id,
    exp: Math.floor(now / 1000) + ttlSeconds,
    sub,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${mac(body)}`;
}

export function verifyDocumentAccess(token: string | null | undefined, now = Date.now()): TokenPayload | null {
  if (!token) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;
  const expected = mac(body);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<TokenPayload>;
    if (!payload.id || !payload.sub || !payload.exp || payload.exp * 1000 <= now) return null;
    return { id: payload.id, exp: payload.exp, sub: payload.sub };
  } catch {
    return null;
  }
}
