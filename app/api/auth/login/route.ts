import { NextRequest } from "next/server";
import { authenticate } from "@/lib/services/accounts";
import { createSessionToken, csrfCookieOptions, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { CSRF_COOKIE } from "@/lib/security/csrf";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { loginSchema } from "@/lib/validation/schemas";
import { homeForRole } from "@/lib/auth/current";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = guardRequest(req, payload, {
    limit: { key: "login", max: 10, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(loginSchema, payload);
  if (!parsed.success) return json({ error: "Enter the email and password." }, 400);
  const user = await authenticate(parsed.data.email, parsed.data.password, guard.ip);
  if (!user) return json({ error: "Invalid email or password." }, 401);
  const csrf = req.cookies.get(CSRF_COOKIE)?.value ?? crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const token = createSessionToken({
    sub: user.id,
    role: user.role,
    name: user.name,
    csrf,
  });
  const response = json({ ok: true, role: user.role, next: homeForRole(user.role) });
  response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  response.cookies.set(CSRF_COOKIE, csrf, csrfCookieOptions());
  return response;
}
