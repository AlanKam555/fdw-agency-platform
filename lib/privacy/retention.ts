import { purgeStaleSessions, type SessionPurgeCounts } from "@/lib/auth/session-purge";
import type { CandidateStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { PRIVACY_POLICY } from "@/lib/privacy/policy";
import { redactCandidate } from "@/lib/services/engagement";

const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_BATCH = 50;

const ACTIVE_STATUSES: CandidateStatus[] = [
  "APPLIED",
  "SCREENED",
  "AVAILABLE",
  "MATCHED",
  "MOM_SUBMITTED",
  "APPROVED",
];

export type RetentionCounts = {
  enquiries: number;
  candidates: number;
  auditLogs: number;
  unverifiedAccounts: number;
};

export type RetentionReport = {
  asOf: string;
  enforced: boolean;
  auditPurged: boolean;
  limited: boolean;
  counts: RetentionCounts;
  processed: RetentionCounts;
  sessions: SessionPurgeCounts;
  note: string;
};

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export function candidateIsDue(input: {
  status: CandidateStatus | string;
  updatedAt: Date;
  redactedAt: Date | null;
  now: Date;
}): boolean {
  if (input.redactedAt) return false;
  const rules = PRIVACY_POLICY.retention;
  const windowDays =
    input.status === "REJECTED" || input.status === "WITHDRAWN"
      ? rules.rejectedApplicationDays
      : input.status === "DEPLOYED"
        ? rules.deployedRecordDays
        : rules.activeApplicationDays;
  return input.now.getTime() - input.updatedAt.getTime() >= windowDays * DAY_MS;
}

export function recordIsDue(createdAt: Date, now: Date, windowDays: number): boolean {
  return now.getTime() - createdAt.getTime() >= windowDays * DAY_MS;
}

export function retentionMode(): { enforce: boolean; purgeAudit: boolean } {
  return {
    enforce: process.env.RETENTION_ENFORCE === "true",
    purgeAudit: process.env.RETENTION_PURGE_AUDIT === "true",
  };
}

export async function runRetention(options?: {
  now?: Date;
  enforce?: boolean;
  purgeAudit?: boolean;
  ip?: string;
}): Promise<RetentionReport> {
  const now = options?.now ?? new Date();
  const mode = retentionMode();
  const enforce = options?.enforce ?? mode.enforce;
  const purgeAudit = options?.purgeAudit ?? mode.purgeAudit;
  const rules = PRIVACY_POLICY.retention;
  const enquiryBefore = daysAgo(now, rules.enquiryDays);
  const rejectedBefore = daysAgo(now, rules.rejectedApplicationDays);
  const activeBefore = daysAgo(now, rules.activeApplicationDays);
  const deployedBefore = daysAgo(now, rules.deployedRecordDays);
  const auditBefore = daysAgo(now, rules.auditLogDays);
  const unverifiedBefore = daysAgo(now, rules.unverifiedAccountDays);
  const unverifiedWhere = {
    emailVerifiedAt: null,
    role: { in: ["EMPLOYER", "CANDIDATE"] as ["EMPLOYER", "CANDIDATE"] },
    createdAt: { lt: unverifiedBefore },
  };

  const [enquiryCount, rejectedCount, activeCount, deployedCount, auditCount, unverifiedCount] = await Promise.all([
    prisma.enquiry.count({ where: { createdAt: { lt: enquiryBefore } } }),
    prisma.candidate.count({
      where: {
        redactedAt: null,
        status: { in: ["REJECTED", "WITHDRAWN"] },
        updatedAt: { lt: rejectedBefore },
      },
    }),
    prisma.candidate.count({
      where: { redactedAt: null, status: { in: ACTIVE_STATUSES }, updatedAt: { lt: activeBefore } },
    }),
    prisma.candidate.count({
      where: { redactedAt: null, status: "DEPLOYED", updatedAt: { lt: deployedBefore } },
    }),
    prisma.auditLog.count({ where: { createdAt: { lt: auditBefore } } }),
    prisma.user.count({ where: unverifiedWhere }),
  ]);

  const candidateCount = rejectedCount + activeCount + deployedCount;
  const [enquiries, rejected, active, deployed, audits, unverifiedUsers] = await Promise.all([
    prisma.enquiry.findMany({
      where: { createdAt: { lt: enquiryBefore } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: RETENTION_BATCH,
    }),
    prisma.candidate.findMany({
      where: {
        redactedAt: null,
        status: { in: ["REJECTED", "WITHDRAWN"] },
        updatedAt: { lt: rejectedBefore },
      },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: RETENTION_BATCH,
    }),
    prisma.candidate.findMany({
      where: { redactedAt: null, status: { in: ACTIVE_STATUSES }, updatedAt: { lt: activeBefore } },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: RETENTION_BATCH,
    }),
    prisma.candidate.findMany({
      where: { redactedAt: null, status: "DEPLOYED", updatedAt: { lt: deployedBefore } },
      select: { id: true },
      orderBy: { updatedAt: "asc" },
      take: RETENTION_BATCH,
    }),
    prisma.auditLog.findMany({
      where: { createdAt: { lt: auditBefore } },
      select: { id: true },
      orderBy: { createdAt: "asc" },
      take: RETENTION_BATCH,
    }),
    prisma.user.findMany({
      where: unverifiedWhere,
      select: { id: true, candidate: { select: { id: true, status: true } } },
      orderBy: { createdAt: "asc" },
      take: RETENTION_BATCH,
    }),
  ]);

  const candidateIds = [...rejected, ...active, ...deployed].slice(0, RETENTION_BATCH).map((row) => row.id);
  const limited =
    enquiryCount > enquiries.length ||
    candidateCount > candidateIds.length ||
    auditCount > audits.length ||
    unverifiedCount > unverifiedUsers.length;

  const processed: RetentionCounts = { enquiries: 0, candidates: 0, auditLogs: 0, unverifiedAccounts: 0 };
  if (enforce) {
    for (const id of candidateIds) {
      const result = await redactCandidate({ candidateId: id, actorId: null, ip: options?.ip ?? "cron" });
      if (result.ok) processed.candidates += 1;
    }
    if (enquiries.length) {
      const deleted = await prisma.enquiry.deleteMany({
        where: { id: { in: enquiries.map((row) => row.id) } },
      });
      processed.enquiries = deleted.count;
    }
  }
  if (enforce && purgeAudit && audits.length) {
    const deleted = await prisma.auditLog.deleteMany({
      where: { id: { in: audits.map((row) => row.id) } },
    });
    processed.auditLogs = deleted.count;
  }
  if (enforce) {
    for (const user of unverifiedUsers) {
      if (user.candidate && user.candidate.status !== "APPLIED") continue;
      try {
        if (user.candidate) await prisma.candidate.delete({ where: { id: user.candidate.id } });
        await prisma.user.delete({ where: { id: user.id } });
        processed.unverifiedAccounts += 1;
      } catch {
        logEvent("error", "privacy.retention_unverified_skipped", {});
      }
    }
  }

  const sessions = await purgeStaleSessions(now);

  await writeAudit({
    action: enforce ? "privacy.retention_enforce" : "privacy.retention_dry_run",
    entityType: "Retention",
    entityId: now.toISOString(),
    metadata: {
      enquiryCount,
      candidateCount,
      auditCount,
      processedCandidates: processed.candidates,
      processedEnquiries: processed.enquiries,
      processedAuditLogs: processed.auditLogs,
      unverifiedAccounts: unverifiedCount,
      processedUnverifiedAccounts: processed.unverifiedAccounts,
      purgeAudit: enforce && purgeAudit,
      sessionsExpired: sessions.expired,
      sessionsRevoked: sessions.revoked,
    },
    ip: options?.ip ?? "cron",
  });

  return {
    asOf: now.toISOString(),
    enforced: enforce,
    auditPurged: enforce && purgeAudit,
    limited,
    counts: {
      enquiries: enquiryCount,
      candidates: candidateCount,
      auditLogs: auditCount,
      unverifiedAccounts: unverifiedCount,
    },
    processed,
    sessions,
    note: enforce
      ? "Due helper profiles were redacted and due enquiries were deleted. Audit rows are removed only when purge is also on. Expired sessions, and revoked sessions past the retention window, are deleted on every run. See docs/retention.md."
      : "Dry run for personal data. Counts are records past the policy windows. Set RETENTION_ENFORCE=true to redact and delete. Expired and revoked sessions are still deleted. See docs/retention.md.",
  };
}
