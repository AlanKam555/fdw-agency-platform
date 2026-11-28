import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hashAuditRow } from "@/lib/audit-chain";
import { shipAuditRow } from "@/lib/audit-export";
import { notifyAnomaly } from "@/lib/security/alerts";
import { logEvent } from "@/lib/log";

const SENSITIVE = /passport|fin|nric|medical|password|secret|token|totp|recovery|otp|authorization/i;

const SPIKES: Record<string, { env: string; fallback: number; kind: "auth.mfa_spike" | "auth.lockout_spike" }> = {
  "auth.mfa_failed": { env: "MFA_FAIL_HOURLY_ALERT", fallback: 10, kind: "auth.mfa_spike" },
  "auth.mfa_replay": { env: "MFA_FAIL_HOURLY_ALERT", fallback: 10, kind: "auth.mfa_spike" },
  "auth.lockout": { env: "LOCKOUT_HOURLY_ALERT", fallback: 8, kind: "auth.lockout_spike" },
};

export function safeMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return undefined;
  const copy: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE.test(key)) continue;
    if (typeof value === "string" && value.length > 500) {
      copy[key] = `${value.slice(0, 180)}…`;
      continue;
    }
    copy[key] = value;
  }
  return copy;
}

async function noteSpike(action: string, actorId: string | null) {
  const rule = SPIKES[action];
  if (!rule) return;
  const threshold = Number(process.env[rule.env] ?? rule.fallback);
  const limit = Number.isFinite(threshold) && threshold > 0 ? threshold : rule.fallback;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const count = await prisma.auditLog.count({
    where: { action, createdAt: { gte: since } },
  });
  if (count === limit) {
    await notifyAnomaly({ kind: rule.kind, actorId, count });
  }
}

export async function writeAudit(entry: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  const metadata = safeMetadata(entry.metadata) ?? null;
  const actorId = entry.actorId ?? null;
  const ip = entry.ip ?? null;
  let shipped: {
    seq: number;
    prevHash: string;
    rowHash: string;
    createdAt: string;
  } | null = null;
  try {
    shipped = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "AuditChainHead" ("id", "seq", "rowHash", "updatedAt")
        VALUES ('head', 0, '', NOW())
        ON CONFLICT ("id") DO NOTHING
      `;
      const heads = await tx.$queryRaw<Array<{ seq: number; rowHash: string }>>`
        SELECT "seq", "rowHash" FROM "AuditChainHead" WHERE "id" = 'head' FOR UPDATE
      `;
      const head = heads[0] ?? { seq: 0, rowHash: "" };
      const seq = head.seq + 1;
      const prevHash = head.rowHash ?? "";
      const rowHash = hashAuditRow({
        seq,
        actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata,
        ip,
        prevHash,
      });
      const created = await tx.auditLog.create({
        data: {
          actorId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          ip,
          seq,
          prevHash,
          rowHash,
        },
      });
      await tx.auditChainHead.update({
        where: { id: "head" },
        data: { seq, rowHash },
      });
      return { seq, prevHash, rowHash, createdAt: created.createdAt.toISOString() };
    });
  } catch (error) {
    logEvent("error", "audit.write_failed", {
      action: entry.action,
      error: error instanceof Error ? error.name : "Error",
    });
    throw error;
  }
  if (shipped) {
    await shipAuditRow({
      seq: shipped.seq,
      actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      prevHash: shipped.prevHash,
      rowHash: shipped.rowHash,
      createdAt: shipped.createdAt,
    }).catch(() => undefined);
    await noteSpike(entry.action, actorId).catch(() => undefined);
  }
}
