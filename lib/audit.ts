import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

const SENSITIVE = /passport|fin|nric|medical|password|secret|token/i;

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

export async function writeAudit(entry: {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId ?? null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: safeMetadata(entry.metadata) as Prisma.InputJsonValue | undefined,
      ip: entry.ip ?? null,
    },
  });
}
