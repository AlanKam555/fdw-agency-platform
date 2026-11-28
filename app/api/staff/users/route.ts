import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/security/passwords";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { staffUserSchema, staffActionSchema } from "@/lib/validation/schemas";
import { disableUserAccount, resetUserPassword } from "@/lib/services/accounts";
import { resetStaffTotp } from "@/lib/security/totp";
import { revokeAllSessions, revokeSessionById } from "@/lib/auth/sessions";
import { clearSessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "users:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(staffUserSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return json({ error: "That email is already in use." }, 409);
  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.data.name,
      role: parsed.data.role,
      passwordHash: await hashPassword(parsed.data.password),
      emailVerifiedAt: new Date(),
    },
  });
  await writeAudit({
    actorId: guard.session!.sub,
    action: "user.create",
    entityType: "User",
    entityId: user.id,
    metadata: { role: user.role },
    ip: guard.ip,
  });
  return json({ ok: true, id: user.id });
}

export async function PATCH(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, { permission: "users:manage" });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(staffActionSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const actorId = guard.session!.sub;

  if (parsed.data.action === "disable") {
    const result = await disableUserAccount({ actorId, userId: parsed.data.userId, ip: guard.ip });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ ok: true });
  }

  if (parsed.data.action === "sign_out_everywhere") {
    await revokeAllSessions({
      userId: parsed.data.userId,
      reason: "sign_out_everywhere",
      actorId,
      ip: guard.ip,
    });
    const response = json({ ok: true, next: actorId === parsed.data.userId ? "/login" : undefined });
    if (actorId === parsed.data.userId) {
      response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
    }
    return response;
  }

  if (parsed.data.action === "reset_totp") {
    const result = await resetStaffTotp({
      actorId,
      userId: parsed.data.userId,
      password: parsed.data.password,
      code: parsed.data.code,
      ip: guard.ip,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    return json({ ok: true });
  }

  if (parsed.data.action === "set_password") {
    const result = await resetUserPassword({
      actorId,
      userId: parsed.data.userId,
      nextPassword: parsed.data.password,
      ip: guard.ip,
    });
    if (!result.ok) return json({ error: result.error }, result.status);
    const response = json({ ok: true });
    if (actorId === parsed.data.userId) {
      response.cookies.set(SESSION_COOKIE, "", clearSessionCookieOptions());
    }
    return response;
  }

  const revoked = await revokeSessionById({
    sessionId: parsed.data.sessionId,
    actorId,
    ip: guard.ip,
  });
  if (!revoked) return json({ error: "That session is already closed." }, 404);
  return json({ ok: true });
}
