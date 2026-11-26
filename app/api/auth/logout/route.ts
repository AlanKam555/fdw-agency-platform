import { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { guardRequest, json } from "@/lib/http/api";
import { writeAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload);
  if (!guard.ok) return guard.response;
  if (guard.session) {
    await writeAudit({
      actorId: guard.session.sub,
      action: "auth.logout",
      entityType: "User",
      entityId: guard.session.sub,
      ip: guard.ip,
    });
  }
  const response = json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
