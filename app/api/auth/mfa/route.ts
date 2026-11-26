import { NextRequest } from "next/server";
import { guardRequest, json, parseBody, zodMessage } from "@/lib/http/api";
import { beginTotpSetup, confirmTotpSetup, replaceRecoveryCodes, clearTotp, consumeTotpCode, consumeRecoveryCode } from "@/lib/security/totp";
import { brand } from "@/config/brand";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/security/passwords";
import { z } from "zod";

const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
const disableSchema = z.object({
  password: z.string().min(1).max(72),
  code: z.string().regex(/^\d{6}$/).optional(),
  recoveryCode: z.string().min(8).max(32).optional(),
});

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload);
  if (!guard.ok) return guard.response;
  if (!guard.session) return json({ error: "Sign in required." }, 401);
  const started = await beginTotpSetup({
    userId: guard.session.sub,
    email: (await prisma.user.findUnique({ where: { id: guard.session.sub }, select: { email: true } }))?.email ?? "account",
    issuer: brand.name,
    ip: guard.ip,
  });
  if (!started.ok) return json({ error: started.error }, started.status);
  return json({ ok: true, secret: started.secret, otpauthUrl: started.otpauthUrl });
}

export async function PUT(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload);
  if (!guard.ok) return guard.response;
  if (!guard.session) return json({ error: "Sign in required." }, 401);
  const parsed = parseBody(codeSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const confirmed = await confirmTotpSetup({
    userId: guard.session.sub,
    code: parsed.data.code,
    ip: guard.ip,
  });
  if (!confirmed.ok) return json({ error: confirmed.error }, confirmed.status);
  return json({ ok: true, recoveryCodes: confirmed.recoveryCodes });
}

export async function PATCH(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload);
  if (!guard.ok) return guard.response;
  if (!guard.session) return json({ error: "Sign in required." }, 401);
  const parsed = parseBody(codeSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const verified = await consumeTotpCode({ userId: guard.session.sub, code: parsed.data.code, ip: guard.ip });
  if (!verified.ok) return json({ error: "Invalid authentication code." }, 401);
  const recoveryCodes = await replaceRecoveryCodes(guard.session.sub, guard.ip);
  return json({ ok: true, recoveryCodes });
}

export async function DELETE(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload);
  if (!guard.ok) return guard.response;
  if (!guard.session) return json({ error: "Sign in required." }, 401);
  if (guard.session.role === "ADMIN" || guard.session.role === "STAFF") {
    return json({ error: "Staff accounts cannot turn two-factor authentication off." }, 403);
  }
  const parsed = parseBody(disableSchema, payload);
  if (!parsed.success) return json({ error: zodMessage(parsed.error) }, 400);
  const user = await prisma.user.findUnique({ where: { id: guard.session.sub } });
  if (!user) return json({ error: "Sign in required." }, 401);
  const passwordOk = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!passwordOk) return json({ error: "The current password is not correct." }, 401);
  const second = parsed.data.recoveryCode
    ? await consumeRecoveryCode({ userId: user.id, code: parsed.data.recoveryCode, ip: guard.ip })
    : parsed.data.code
      ? await consumeTotpCode({ userId: user.id, code: parsed.data.code, ip: guard.ip })
      : { ok: false as const };
  if (!second.ok) return json({ error: "Invalid authentication code." }, 401);
  await clearTotp(user.id, guard.ip);
  return json({ ok: true });
}
