import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { authenticate } from "@/lib/services/accounts";
import { issueSession } from "@/lib/auth/sessions";
import { homeForRole } from "@/lib/auth/current";
import { csrfCookieOptions, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth/session";
import { CSRF_COOKIE } from "@/lib/security/csrf";
import { guardRequest, json, parseBody } from "@/lib/http/api";
import { loginSchema } from "@/lib/validation/schemas";
import { brand } from "@/config/brand";
import {
  clearSignInFailures,
  gateSignIn,
  INVALID_LOGIN_MESSAGE,
  noteSignInFailure,
  sleepForLockout,
} from "@/lib/security/lockout";
import { consumeRecoveryCode, consumeTotpCode, graceDaysFromEnv } from "@/lib/security/totp";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => ({}));
  const guard = await guardRequest(req, payload, {
    limit: { key: "login", max: 60, windowMs: 15 * 60 * 1000 },
  });
  if (!guard.ok) return guard.response;
  const parsed = parseBody(loginSchema, payload);
  if (!parsed.success) return json({ error: "Enter the email and password." }, 400);

  const email = parsed.data.email;
  const gate = await gateSignIn(email, guard.ip);
  if (gate.locked) {
    await writeAudit({
      action: "auth.lockout",
      entityType: "User",
      entityId: "locked",
      metadata: { scope: gate.scope, failures: gate.count },
      ip: guard.ip,
    });
    return json({ error: INVALID_LOGIN_MESSAGE }, 401, { "Retry-After": String(gate.retryAfterSeconds) });
  }
  await sleepForLockout(gate.delayMs);

  const user = await authenticate(email, parsed.data.password, guard.ip);
  if (!user) {
    const failed = await noteSignInFailure(email, guard.ip);
    if (failed.justLocked) {
      await writeAudit({
        action: "auth.lockout",
        entityType: "User",
        entityId: "locked",
        metadata: { scope: failed.scope, failures: failed.count },
        ip: guard.ip,
      });
    }
    const headers = failed.locked ? { "Retry-After": String(failed.retryAfterSeconds) } : undefined;
    return json({ error: INVALID_LOGIN_MESSAGE }, 401, headers);
  }

  const code = parsed.data.code || undefined;
  const recovery = parsed.data.recoveryCode || undefined;
  if (user.totpEnabledAt) {
    if (!code && !recovery) {
      return json({ error: "Enter the authentication code.", mfa: "totp" }, 401);
    }
    const verified = recovery
      ? await consumeRecoveryCode({ userId: user.id, code: recovery, ip: guard.ip })
      : await consumeTotpCode({ userId: user.id, code: code ?? "", ip: guard.ip });
    if (!verified.ok) {
      return json({ error: "Invalid authentication code.", mfa: "totp" }, 401);
    }
  } else if ((user.role === "ADMIN" || user.role === "STAFF") && !user.totpSetupDueAt) {
    const until = new Date(Date.now() + graceDaysFromEnv() * 24 * 60 * 60 * 1000);
    await prisma.user.update({ where: { id: user.id }, data: { totpSetupDueAt: until } });
    user.totpSetupDueAt = until;
  }

  await clearSignInFailures(email, guard.ip);
  const csrf =
    req.cookies.get(CSRF_COOKIE)?.value ??
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const issued = await issueSession({
    user,
    csrf,
    ip: guard.ip,
    userAgent: req.headers.get("user-agent"),
  });
  await writeAudit({
    actorId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    ip: guard.ip,
  });
  const needsSetup = (user.role === "ADMIN" || user.role === "STAFF") && !user.totpEnabledAt;
  const response = json({
    ok: true,
    role: user.role,
    next: needsSetup ? "/account/security" : homeForRole(user.role),
    mfaSetup: needsSetup,
    issuer: brand.name,
  });
  response.cookies.set(SESSION_COOKIE, issued.token, sessionCookieOptions());
  response.cookies.set(CSRF_COOKIE, csrf, csrfCookieOptions());
  return response;
}
