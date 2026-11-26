import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { csrfCookieOptions, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { contentSecurityPolicy } from "@/lib/security/csp";
import { CSRF_COOKIE } from "@/lib/security/csrf";
import type { Role } from "@/lib/security/rbac";

function sessionRole(request: NextRequest): Role | null {
  try {
    return verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)?.role ?? null;
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const existing = request.cookies.get(CSRF_COOKIE)?.value;
  const token = existing ?? randomBytes(32).toString("base64url");
  const nonce = randomBytes(16).toString("base64url");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-hl-csrf", token);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const path = request.nextUrl.pathname;
  const role = sessionRole(request);
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

  response.headers.set("Content-Security-Policy", csp);
  if (!existing) {
    response.cookies.set(CSRF_COOKIE, token, csrfCookieOptions());
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
