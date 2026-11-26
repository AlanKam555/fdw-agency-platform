import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { generateSecret, generateSync, generateURI, verifySync } from "otplib";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { decryptString, encryptString, secretsEqual } from "@/lib/crypto/field-encryption";
import { logEvent } from "@/lib/log";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import type { Role } from "@/lib/security/rbac";

const PERIOD_SECONDS = 30;
const MFA_LIMIT = 5;
const MFA_WINDOW_MS = 15 * 60 * 1000;

export type TotpUser = {
  role: Role | string;
  totpEnabledAt: Date | null;
  totpSetupDueAt: Date | null;
};

function totpKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY || process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOTP_ENCRYPTION_KEY or FIELD_ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOTP encryption key must be 32 bytes, base64-encoded");
  }
  return key;
}

function pepper(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 16) {
    throw new Error("AUTH_SECRET must be set to a string of at least 16 characters");
  }
  return value;
}

export function graceDaysFromEnv(): number {
  const raw = Number(process.env.MFA_GRACE_DAYS ?? "7");
  if (!Number.isFinite(raw) || raw < 0 || raw > 90) return 7;
  return Math.floor(raw);
}

export function mfaGraceOpen(user: TotpUser, now = Date.now()): boolean {
  if (user.role !== "ADMIN" && user.role !== "STAFF") return false;
  if (user.totpEnabledAt || !user.totpSetupDueAt) return false;
  return user.totpSetupDueAt.getTime() > now;
}

export function mfaSetupBlocks(user: TotpUser, now = Date.now()): boolean {
  if (user.role !== "ADMIN" && user.role !== "STAFF") return false;
  if (user.totpEnabledAt) return false;
  if (!user.totpSetupDueAt) return false;
  return user.totpSetupDueAt.getTime() <= now;
}

export function encryptTotpSecret(secret: string): string {
  return encryptString(secret, totpKey());
}

export function decryptTotpSecret(payload: string): string {
  return decryptString(payload, totpKey());
}

export function checkTotp(input: {
  secret: string;
  token: string;
  lastStep: number | null;
  nowMs?: number;
}): { ok: true; timeStep: number } | { ok: false; reason: "invalid" | "replay" } {
  const token = input.token.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return { ok: false, reason: "invalid" };
  const epoch = input.nowMs ? Math.floor(input.nowMs / 1000) : undefined;
  const result = verifySync({
    secret: input.secret,
    token,
    period: PERIOD_SECONDS,
    epoch,
    epochTolerance: PERIOD_SECONDS,
    afterTimeStep: input.lastStep ?? undefined,
  });
  if (result.valid && "timeStep" in result) return { ok: true, timeStep: result.timeStep };
  if (input.lastStep != null) {
    const again = verifySync({
      secret: input.secret,
      token,
      period: PERIOD_SECONDS,
      epoch,
      epochTolerance: PERIOD_SECONDS,
    });
    if (again.valid && "timeStep" in again && again.timeStep <= input.lastStep) {
      return { ok: false, reason: "replay" };
    }
  }
  return { ok: false, reason: "invalid" };
}

export function currentTotp(secret: string, nowMs = Date.now()): string {
  return generateSync({ secret, period: PERIOD_SECONDS, epoch: Math.floor(nowMs / 1000) });
}

export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hashRecoveryCode(code: string): string {
  return createHmac("sha256", pepper()).update(normalizeRecoveryCode(code)).digest("hex");
}

export function recoveryMatches(code: string, hash: string): boolean {
  const left = Buffer.from(hashRecoveryCode(code));
  const right = Buffer.from(hash);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function generateRecoveryCodes(count = 8): string[] {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

async function limited(key: string): Promise<{ ok: true } | { ok: false; retryAfterSeconds: number }> {
  const result = await consumeRateLimit(key, MFA_LIMIT, MFA_WINDOW_MS);
  if (!result.ok) return { ok: false, retryAfterSeconds: result.retryAfterSeconds };
  return { ok: true };
}

export async function beginTotpSetup(input: {
  userId: string;
  email: string;
  issuer: string;
  ip?: string | null;
}): Promise<{ ok: true; secret: string; otpauthUrl: string } | { ok: false; error: string; status: number }> {
  const gate = await consumeRateLimit(`mfa-setup:${input.userId}`, 10, 60 * 60 * 1000);
  if (!gate.ok) return { ok: false, error: "Too many setup attempts. Try again shortly.", status: 429 };
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.disabledAt) return { ok: false, error: "Sign in required.", status: 401 };
  if (user.totpEnabledAt) return { ok: false, error: "Two-factor authentication is already on.", status: 409 };
  const secret = generateSecret();
  const otpauthUrl = generateURI({
    issuer: input.issuer.slice(0, 40) || "Agency",
    label: input.email,
    secret,
    period: PERIOD_SECONDS,
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { totpPendingSecretEnc: encryptTotpSecret(secret) },
  });
  await writeAudit({
    actorId: user.id,
    action: "auth.mfa_setup_started",
    entityType: "User",
    entityId: user.id,
    ip: input.ip,
  });
  return { ok: true, secret, otpauthUrl };
}

export async function confirmTotpSetup(input: {
  userId: string;
  code: string;
  ip?: string | null;
}): Promise<
  | { ok: true; recoveryCodes: string[] }
  | { ok: false; error: string; status: number; retryAfterSeconds?: number }
> {
  const gate = await limited(`mfa:${input.userId}`);
  if (!gate.ok) {
    return {
      ok: false,
      error: "Invalid authentication code.",
      status: 401,
      retryAfterSeconds: gate.retryAfterSeconds,
    };
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.disabledAt || !user.totpPendingSecretEnc) {
    return { ok: false, error: "Start setup again before entering a code.", status: 400 };
  }
  const secret = decryptTotpSecret(user.totpPendingSecretEnc);
  const checked = checkTotp({ secret, token: input.code, lastStep: user.totpLastStep });
  if (!checked.ok) {
    await writeAudit({
      actorId: user.id,
      action: checked.reason === "replay" ? "auth.mfa_replay" : "auth.mfa_failed",
      entityType: "User",
      entityId: user.id,
      ip: input.ip,
    });
    return { ok: false, error: "Invalid authentication code.", status: 401 };
  }
  const recoveryCodes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        totpSecretEnc: user.totpPendingSecretEnc,
        totpPendingSecretEnc: null,
        totpEnabledAt: new Date(),
        totpLastStep: checked.timeStep,
      },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId: user.id } }),
    prisma.recoveryCode.createMany({
      data: recoveryCodes.map((code) => ({ userId: user.id, codeHash: hashRecoveryCode(code) })),
    }),
  ]);
  await writeAudit({
    actorId: user.id,
    action: "auth.mfa_enabled",
    entityType: "User",
    entityId: user.id,
    ip: input.ip,
  });
  logEvent("info", "auth.mfa_enabled", { userId: user.id });
  return { ok: true, recoveryCodes };
}

export async function consumeTotpCode(input: {
  userId: string;
  code: string;
  ip?: string | null;
}): Promise<{ ok: true } | { ok: false; retryAfterSeconds?: number; reason: "invalid" | "replay" | "limited" }> {
  const gate = await limited(`mfa:${input.userId}`);
  if (!gate.ok) {
    await writeAudit({
      actorId: input.userId,
      action: "auth.mfa_limited",
      entityType: "User",
      entityId: input.userId,
      ip: input.ip,
    });
    return { ok: false, reason: "limited", retryAfterSeconds: gate.retryAfterSeconds };
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user?.totpSecretEnc || !user.totpEnabledAt) return { ok: false, reason: "invalid" };
  const secret = decryptTotpSecret(user.totpSecretEnc);
  const checked = checkTotp({ secret, token: input.code, lastStep: user.totpLastStep });
  if (!checked.ok) {
    await writeAudit({
      actorId: user.id,
      action: checked.reason === "replay" ? "auth.mfa_replay" : "auth.mfa_failed",
      entityType: "User",
      entityId: user.id,
      ip: input.ip,
    });
    return { ok: false, reason: checked.reason };
  }
  const saved = await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [{ totpLastStep: null }, { totpLastStep: { lt: checked.timeStep } }],
    },
    data: { totpLastStep: checked.timeStep },
  });
  if (saved.count !== 1) {
    await writeAudit({
      actorId: user.id,
      action: "auth.mfa_replay",
      entityType: "User",
      entityId: user.id,
      ip: input.ip,
    });
    return { ok: false, reason: "replay" };
  }
  return { ok: true };
}

export async function consumeRecoveryCode(input: {
  userId: string;
  code: string;
  ip?: string | null;
}): Promise<{ ok: true } | { ok: false; retryAfterSeconds?: number }> {
  const gate = await limited(`mfa:${input.userId}`);
  if (!gate.ok) return { ok: false, retryAfterSeconds: gate.retryAfterSeconds };
  const hash = hashRecoveryCode(input.code);
  const rows = await prisma.recoveryCode.findMany({
    where: { userId: input.userId, usedAt: null },
    select: { id: true, codeHash: true },
  });
  let matchId: string | null = null;
  const dummy = hashRecoveryCode("placeholder");
  if (rows.length === 0) secretsEqual(dummy, hash);
  for (const row of rows) {
    if (secretsEqual(row.codeHash, hash)) matchId = row.id;
  }
  if (!matchId) {
    await writeAudit({
      actorId: input.userId,
      action: "auth.mfa_failed",
      entityType: "User",
      entityId: input.userId,
      metadata: { method: "recovery" },
      ip: input.ip,
    });
    return { ok: false };
  }
  const used = await prisma.recoveryCode.updateMany({
    where: { id: matchId, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (used.count !== 1) return { ok: false };
  await writeAudit({
    actorId: input.userId,
    action: "auth.mfa_recovery_used",
    entityType: "User",
    entityId: input.userId,
    ip: input.ip,
  });
  logEvent("info", "auth.mfa_recovery_used", { userId: input.userId });
  return { ok: true };
}

export async function replaceRecoveryCodes(userId: string, ip?: string | null): Promise<string[]> {
  const codes = generateRecoveryCodes();
  await prisma.$transaction([
    prisma.recoveryCode.deleteMany({ where: { userId } }),
    prisma.recoveryCode.createMany({
      data: codes.map((code) => ({ userId, codeHash: hashRecoveryCode(code) })),
    }),
  ]);
  await writeAudit({
    actorId: userId,
    action: "auth.mfa_recovery_replaced",
    entityType: "User",
    entityId: userId,
    ip,
  });
  return codes;
}

export async function clearTotp(userId: string, ip?: string | null): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpPendingSecretEnc: null,
        totpEnabledAt: null,
        totpLastStep: null,
      },
    }),
    prisma.recoveryCode.deleteMany({ where: { userId } }),
  ]);
  await writeAudit({
    actorId: userId,
    action: "auth.mfa_disabled",
    entityType: "User",
    entityId: userId,
    ip,
  });
  logEvent("info", "auth.mfa_disabled", { userId });
}
