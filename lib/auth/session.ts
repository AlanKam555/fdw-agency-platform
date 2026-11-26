import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Role } from "@/lib/security/rbac";

export const SESSION_COOKIE = "hl_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  sub: string;
  role: Role;
  name: string;
  exp: number;
  csrf: string;
  sid: string;
};

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET must be set to a string of at least 16 characters");
  }
  return value;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function createSessionToken(input: {
  sub: string;
  role: Role;
  name: string;
  csrf?: string;
  sid: string;
  now?: number;
}): string {
  const payload: SessionPayload = {
    sub: input.sub,
    role: input.role,
    name: input.name,
    exp: Math.floor((input.now ?? Date.now()) / 1000) + SESSION_MAX_AGE_SECONDS,
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
    maxAge: SESSION_MAX_AGE_SECONDS,
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
