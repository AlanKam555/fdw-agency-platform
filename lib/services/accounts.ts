import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/lib/security/passwords";
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
  if (!user || user.disabledAt || !matches) {
    await writeAudit({
      action: "auth.login_failed",
      entityType: "User",
      entityId: user?.id ?? "unknown",
      metadata: { email: email.toLowerCase() },
      ip,
    });
    return null;
  }
  await writeAudit({
    actorId: user.id,
    action: "auth.login",
    entityType: "User",
    entityId: user.id,
    ip,
  });
  return user;
}

export async function registerAccount(input: {
  role: Extract<Role, "EMPLOYER" | "CANDIDATE">;
  name: string;
  email: string;
  password: string;
  ip: string;
}) {
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false as const, error: "An account with this email already exists. Sign in instead." };
  }
  const user = await prisma.user.create({
    data: {
      email,
      name: input.name,
      role: input.role,
      passwordHash: await hashPassword(input.password),
    },
  });
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
  return { ok: true as const, user };
}
