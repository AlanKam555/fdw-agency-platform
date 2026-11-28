import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SESSION_ABSOLUTE_MAX_SECONDS, sessionAbsoluteSeconds } from "@/lib/auth/session-policy";
import { derivedKey } from "@/lib/crypto/hkdf";
import type { Role } from "@/lib/security/rbac";

export const SESSION_COOKIE = "hl_session";
export const SESSION_MAX_AGE_SECONDS = SESSION_ABSOLUTE_MAX_SECONDS;

export type SessionPayload = {
  sub: string;
  role: Role;
  name: string;
  exp: number;
  csrf: string;
  sid: string;
};

function sign(body: string): string {
  return createHmac("sha256", derivedKey("session")).update(body).digest("base64url");
}

export function createSessionToken(input: {
  sub: string;
  role: Role;
  name: string;
  csrf?: string;
  sid: string;
  now?: number;
  lifetimeSeconds?: number;
}): string {
  const requested = input.lifetimeSeconds ?? sessionAbsoluteSeconds();
  const lifetime = Math.min(Math.max(requested, 60), SESSION_ABSOLUTE_MAX_SECONDS);
  const payload: SessionPayload = {
    sub: input.sub,
    role: input.role,
    name: input.name,
    exp: Math.floor((input.now ?? Date.now()) / 1000) + lifetime,
    csrf: input.csrf ?? randomBytes(32).toString("base64url"),
    sid: input.sid,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
  now = Date.now(),
): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.sub || !payload.role || !payload.exp || !payload.csrf || !payload.sid) return null;
    if (payload.exp * 1000 <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Secure cookies follow APP_URL so the http://localhost demo can sign in. */
export function cookiesAreSecure(): boolean {
  const url = process.env.APP_URL;
  if (url) return url.startsWith("https://");
  return process.env.NODE_ENV === "production";
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: cookiesAreSecure(),
    path: "/",
    maxAge: sessionAbsoluteSeconds(),
  };
}

export function clearSessionCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 0 };
}

export function csrfCookieOptions() {
  return {
    httpOnly: false,
    sameSite: "lax" as const,
    secure: cookiesAreSecure(),
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}
