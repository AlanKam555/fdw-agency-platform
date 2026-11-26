import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookieOptions, SESSION_COOKIE, type SessionPayload } from "@/lib/auth/session";
import { resolveRequestSession } from "@/lib/auth/sessions";
import { CSRF_COOKIE, csrfIsValid, originAllowed, appOrigin } from "@/lib/security/csrf";
import { clientIp, consumeRateLimit } from "@/lib/security/rate-limit";
import { hasPermission, type Permission, type Role } from "@/lib/security/rbac";
import { mfaSetupBlocks } from "@/lib/security/totp";
import { z, type ZodError, type ZodTypeAny } from "zod";

export function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers });
}

export function zodMessage(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "form"}: ${issue.message}`)
    .join(" ");
}

const MULTI = new Set([
  "skills",
  "languages",
  "skillsRequired",
  "languagesPreferred",
]);

export async function readPayload(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return {};
    return body as Record<string, unknown>;
  }
  if (contentType.includes("form")) {
    const form = await req.formData();
    const data: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value !== "string") continue;
      const name = key.endsWith("[]") ? key.slice(0, -2) : key;
      if (MULTI.has(name)) {
        const current = data[name];
        data[name] = Array.isArray(current) ? [...current, value] : [value];
        continue;
      }
      data[name] = value;
    }
    return data;
  }
  return {};
}

export async function guardRequest(
  req: NextRequest,
  payload: Record<string, unknown>,
  options: {
    permission?: Permission;
    roles?: readonly Role[];
    limit?: { key: string; max: number; windowMs: number };
    csrf?: boolean;
  } = {},
): Promise<
  | { ok: true; ip: string; session: SessionPayload | null }
  | { ok: false; response: NextResponse }
> {
  const ip = clientIp(req.headers);
  if (options.limit) {
    const result = await consumeRateLimit(
      `${options.limit.key}:${ip}`,
      options.limit.max,
      options.limit.windowMs,
    );
    if (!result.ok) {
      const response = json({ error: "Too many requests. Try again shortly." }, 429);
      response.headers.set("retry-after", String(result.retryAfterSeconds));
      return { ok: false, response };
    }
  }

  if (options.csrf !== false && req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const allowedOrigins = [appOrigin()];
    if (host) {
      allowedOrigins.push(`http://${host}`, `https://${host}`);
    }
    if (!originAllowed(origin, allowedOrigins)) {
      return { ok: false, response: json({ error: "Cross-origin request blocked." }, 403) };
    }
    const cookie = req.cookies.get(CSRF_COOKIE)?.value ?? null;
    const provided =
      req.headers.get("x-csrf-token") ??
      (typeof payload.csrf === "string" ? payload.csrf : null);
    if (!csrfIsValid(cookie, provided)) {
      return { ok: false, response: json({ error: "CSRF check failed." }, 403) };
    }
  }

  let session: SessionPayload | null = null;
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie) {
    let resolved: Awaited<ReturnType<typeof resolveRequestSession>>;
    try {
      resolved = await resolveRequestSession(cookie);
    } catch {
      return { ok: false, response: rejectSession() };
    }
    if (resolved.kind === "disabled") {
      return { ok: false, response: rejectSession() };
    }
    if (resolved.kind === "active") {
      session = resolved.payload;
      const path = req.nextUrl.pathname;
      const mfaExempt =
        path === "/api/auth/logout" ||
        path === "/api/auth/password" ||
        path.startsWith("/api/auth/mfa");
      if (!mfaExempt && mfaSetupBlocks(resolved.user)) {
        return {
          ok: false,
          response: json(
            { error: "Set up two-factor authentication before continuing.", code: "mfa_setup_required" },
            403,
          ),
        };
      }
    }
  }

  if (options.permission || options.roles) {
    if (!session) return { ok: false, response: json({ error: "Sign in required." }, 401) };
    if (options.roles && !options.roles.includes(session.role)) {
      return { ok: false, response: json({ error: "Forbidden." }, 403) };
    }
    if (options.permission && !hasPermission(session.role, options.permission)) {
      return { ok: false, response: json({ error: "Forbidden." }, 403) };
    }
  }

  return { ok: true, ip, session };
}

function rejectSession() {
  const response = json({ error: "Sign in required." }, 401);
  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return response;
}

export function parseBody<S extends ZodTypeAny>(schema: S, payload: Record<string, unknown>) {
  const rest = { ...payload };
  delete rest.csrf;
  return schema.safeParse(rest) as z.SafeParseReturnType<z.input<S>, z.output<S>>;
}
