import { NextRequest } from "next/server";
import { createSessionToken, csrfCookieOptions, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { CSRF_COOKIE } from "@/lib/security/csrf";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { registerAccount } from "@/lib/services/accounts";
import { registerSchema } from "@/lib/validation/schemas";
import { homeForRole } from "@/lib/auth/current";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, {
    limit: { key: "register", max: 8, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(registerSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await registerAccount({ ...parsed.data, ip: guard.ip });
  if (!result.ok) return json({ error: result.error }, 409);
  const csrf = req.cookies.get(CSRF_COOKIE)?.value ?? crypto.randomUUID().replace(/-/g, "") + "csrf";
  const token = createSessionToken({
    sub: result.user.id,
    role: result.user.role,
    name: result.user.name,
    csrf,
  });
  const response = json({ ok: true, next: homeForRole(result.user.role) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.set(CSRF_COOKIE, csrf, csrfCookieOptions());
  return response;
}
