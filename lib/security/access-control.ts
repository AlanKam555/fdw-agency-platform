import { prisma } from "@/lib/db";
import { minimisePii } from "@/lib/ai/pii";
import { notifyAnomaly } from "@/lib/security/alerts";
import type { Role } from "@/lib/security/rbac";

export const ACCESS_REASONS = [
  "MOM_FILING",
  "IDENTITY_CHECK",
  "INTERVIEW_PREP",
  "SUBJECT_ACCESS",
  "INCIDENT_RESPONSE",
  "OTHER",
] as const;

export type AccessReason = (typeof ACCESS_REASONS)[number];

function positive(value: string | undefined, fallback: number): number {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

export function revealQuota() {
  return {
    hourly: positive(process.env.REVEAL_HOURLY_QUOTA, 15),
    daily: positive(process.env.REVEAL_DAILY_QUOTA, 40),
  };
}

export function downloadQuota() {
  return {
    hourly: positive(process.env.DOWNLOAD_HOURLY_QUOTA, 30),
    daily: positive(process.env.DOWNLOAD_DAILY_QUOTA, 80),
  };
}

export function assignmentRequired(): boolean {
  return process.env.STAFF_ASSIGNMENT_REQUIRED === "true";
}

export function reasonMetadata(reasonCode: string, reasonText: string): { reasonCode: string; reasonText: string } {
  return {
    reasonCode,
    reasonText: minimisePii(reasonText).slice(0, 180),
  };
}

async function countSince(actorId: string, actions: string[], since: Date): Promise<number> {
  return prisma.auditLog.count({
    where: { actorId, action: { in: actions }, createdAt: { gte: since } },
  });
}

export async function assertQuota(input: {
  actorId: string;
  actions: string[];
  hourly: number;
  daily: number;
  kind: "access.bulk_reveal" | "access.bulk_download";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = Date.now();
  const hourly = await countSince(input.actorId, input.actions, new Date(now - 60 * 60 * 1000));
  const daily = await countSince(input.actorId, input.actions, new Date(now - 24 * 60 * 60 * 1000));
  if (hourly >= input.hourly || daily >= input.daily) {
    await notifyAnomaly({
      kind: "access.quota_exceeded",
      actorId: input.actorId,
      count: Math.max(hourly, daily),
    });
    if (hourly >= input.hourly * 2 || daily >= input.daily * 2) {
      await notifyAnomaly({ kind: input.kind, actorId: input.actorId, count: Math.max(hourly, daily) });
    }
    return { ok: false, error: "Access quota reached. An administrator has been notified." };
  }
  return { ok: true };
}

export async function assertCandidateAssignment(input: {
  role: Role;
  staffId: string;
  candidateId: string | null | undefined;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!assignmentRequired()) return { ok: true };
  if (input.role === "ADMIN") return { ok: true };
  if (!input.candidateId) return { ok: false, error: "This file is not assigned to you." };
  const row = await prisma.staffAssignment.findUnique({
    where: { staffId_candidateId: { staffId: input.staffId, candidateId: input.candidateId } },
  });
  if (!row) return { ok: false, error: "This file is not assigned to you." };
  return { ok: true };
}
