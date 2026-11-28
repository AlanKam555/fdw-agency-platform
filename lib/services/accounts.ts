import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
import { issueEmailVerification } from "@/lib/security/email-verification";
import type { Role } from "@/lib/security/rbac";
import { PDPA_VERSION } from "@/lib/validation/schemas";

let dummyHash: string | null = null;

async function dummyPasswordHash(): Promise<string> {
  if (!dummyHash) dummyHash = await hashPassword("not-a-real-password");
  return dummyHash;
}

export async function authenticate(email: string, password: string, ip: string) {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  const hash = user?.passwordHash ?? (await dummyPasswordHash());
  const matches = await verifyPassword(password, hash);
  const unverified = user && (user.role === "EMPLOYER" || user.role === "CANDIDATE") && !user.emailVerifiedAt;
  if (!user || user.disabledAt || !matches || unverified) {
    await writeAudit({
      action: "auth.login_failed",
      entityType: "User",
      entityId: user?.id ?? "unknown",
      metadata: { email: email.toLowerCase() },
      ip,
    });
    return null;
  }
  return user;
}

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  nextPassword: string;
  ip: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.disabledAt) return { ok: false as const, error: "Sign in required.", status: 401 };
  const matches = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!matches) return { ok: false as const, error: "The current password is not correct.", status: 401 };
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.nextPassword) },
  });
  const { revokeAllSessions } = await import("@/lib/auth/sessions");
  await revokeAllSessions({ userId: user.id, reason: "password_changed", actorId: user.id, ip: input.ip });
  await writeAudit({
    actorId: user.id,
    action: "auth.password_changed",
    entityType: "User",
    entityId: user.id,
    ip: input.ip,
  });
  return { ok: true as const };
}

export async function resetUserPassword(input: {
  actorId: string;
  userId: string;
  nextPassword: string;
  ip: string;
}) {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false as const, error: "Account not found.", status: 404 };
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.nextPassword) },
  });
  const { revokeAllSessions } = await import("@/lib/auth/sessions");
  await revokeAllSessions({
    userId: user.id,
    reason: "password_reset",
    actorId: input.actorId,
    ip: input.ip,
  });
  await writeAudit({
    actorId: input.actorId,
    action: "user.password_reset",
    entityType: "User",
    entityId: user.id,
    ip: input.ip,
  });
  return { ok: true as const };
}

export async function disableUserAccount(input: { actorId: string; userId: string; ip: string }) {
  if (input.actorId === input.userId) {
    return { ok: false as const, error: "You cannot disable your own account.", status: 400 };
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return { ok: false as const, error: "Account not found.", status: 404 };
  if (!user.disabledAt) {
    await prisma.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
  }
  const { revokeAllSessions } = await import("@/lib/auth/sessions");
  await revokeAllSessions({ userId: user.id, reason: "disabled", actorId: input.actorId, ip: input.ip });
  await writeAudit({
    actorId: input.actorId,
    action: "user.disabled",
    entityType: "User",
    entityId: user.id,
    ip: input.ip,
  });
  return { ok: true as const };
}

export async function registerAccount(input: {
  role: Extract<Role, "EMPLOYER" | "CANDIDATE">;
  name: string;
  email: string;
  password: string;
  ip: string;
}) {
  const email = input.email.toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.emailVerifiedAt && (existing.role === "EMPLOYER" || existing.role === "CANDIDATE")) {
      await issueEmailVerification(existing.id, email);
    }
    await writeAudit({
      action: "auth.register_unconfirmed",
      entityType: "User",
      entityId: existing.id,
      metadata: { outcome: "existing" },
      ip: input.ip,
    });
    return { ok: true as const, created: false as const };
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      role: input.role,
      passwordHash,
    },
  });
  await issueEmailVerification(user.id, email);
  await prisma.consentRecord.create({
    data: {
      subjectType: "User",
      subjectId: user.id,
      purpose: "account",
      policyVersion: PDPA_VERSION,
      granted: true,
    },
  });
  await writeAudit({
    actorId: user.id,
    action: "auth.register",
    entityType: "User",
    entityId: user.id,
    metadata: { role: user.role },
    ip: input.ip,
  });
  return { ok: true as const, created: true as const, user };
}
