import { NextRequest } from "next/server";
import { clearSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { changePassword } from "@/lib/services/accounts";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { passwordChangeSchema } from "@/lib/validation/schemas";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload);
  if (!guard.ok) return guard.response;
  if (!guard.session) return json({ error: "Sign in required." }, 401);
  const parsed = parseBody(passwordChangeSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const result = await changePassword({
    userId: guard.session.sub,
    currentPassword: parsed.data.currentPassword,
    nextPassword: parsed.data.nextPassword,
    ip: guard.ip,
  });
  if (!result.ok) return json({ error: result.error }, result.status);
  const response = json({ ok: true, next: "/login" });
  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return response;
}
