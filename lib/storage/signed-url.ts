import { createHmac, timingSafeEqual } from "node:crypto";

type TokenPayload = { id: string; exp: number };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is required to sign document URLs");
  return value;
}

export function signDocumentAccess(id: string, ttlSeconds = 300, now = Date.now()): string {
  const payload: TokenPayload = {
    id,
    exp: Math.floor(now / 1000) + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyDocumentAccess(
  token: string | null | undefined,
  now = Date.now(),
): TokenPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
    if (!payload.id || payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
