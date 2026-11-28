import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookieOptions, csrfCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { resolveRequestSession } from "@/lib/auth/sessions";
import { contentSecurityPolicy } from "@/lib/security/csp";
import { hstsValue } from "@/lib/security/hsts";
import { CSRF_COOKIE } from "@/lib/security/csrf";
import { logEvent } from "@/lib/log";
import type { Role } from "@/lib/security/rbac";

const OPEN_WHEN_DISABLED = new Set(["/login", "/register", "/forbidden"]);

function applyCsp(response: NextResponse, csp: string, csrf: { token: string; existing: boolean }) {
  response.headers.set("Content-Security-Policy", csp);
  const hsts = hstsValue();
  if (hsts) response.headers.set("Strict-Transport-Security", hsts);
  if (!csrf.existing) {
    response.cookies.set(CSRF_COOKIE, csrf.token, csrfCookieOptions());
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const existing = request.cookies.get(CSRF_COOKIE)?.value;
  const token = existing ?? randomBytes(32).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-hl-csrf", token);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const csrf = { token, existing: Boolean(existing) };

  const path = request.nextUrl.pathname;
  const cookie = request.cookies.get(SESSION_COOKIE)?.value;
  let role: Role | null = null;
  let disabled = false;
  if (cookie) {
    try {
      const resolved = await resolveRequestSession(cookie);
      if (resolved.kind === "disabled") disabled = true;
      if (resolved.kind === "active") role = resolved.user.role;
    } catch {
      logEvent("error", "auth.session_lookup_failed", {});
      role = null;
    }
  }

  if (disabled) {
    if (path.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Sign in required." }, { status: 401 });
      response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
      return applyCsp(response, csp, csrf);
    }
    if (!OPEN_WHEN_DISABLED.has(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", path);
      const response = NextResponse.redirect(url);
      response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
      return applyCsp(response, csp, csrf);
    }
  }

  const required: Role[] | null = path.startsWith("/dashboard")
    ? ["ADMIN", "STAFF"]
    : path === "/employer" || path.startsWith("/employer/")
      ? ["EMPLOYER"]
      : path === "/candidate" || path.startsWith("/candidate/")
        ? ["CANDIDATE"]
        : null;

  let response: NextResponse;
  if (required && !role) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    response = NextResponse.redirect(url);
  } else if (required && role && !required.includes(role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/forbidden";
    url.search = "";
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (disabled) {
    response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  }
  return applyCsp(response, csp, csrf);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
