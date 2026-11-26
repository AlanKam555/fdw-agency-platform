import { NextRequest } from "next/server";
import { clearSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { revokeCurrentSession } from "@/lib/auth/sessions";
import { guardRequest, json } from "@/lib/http/api";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload);
  if (!guard.ok) return guard.response;
  if (guard.session?.sid) {
    await revokeCurrentSession({ sid: guard.session.sid, actorId: guard.session.sub, ip: guard.ip });
  }
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
  return response;
}
