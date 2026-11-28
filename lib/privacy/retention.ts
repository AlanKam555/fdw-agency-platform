import type { CandidateStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { logEvent } from "@/lib/log";
import { PRIVACY_POLICY } from "@/lib/privacy/policy";
import { redactCandidate, redactEmployer } from "@/lib/privacy/redact";
import { reconcileDeletionOutbox } from "@/lib/storage/deletion-outbox";

const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_BATCH = 50;

const ACTIVE_STATUSES: CandidateStatus[] = [
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
  employers: number;
  matchExplanations: number;
  outcomeNotes: number;
  interviewNotes: number;
  marketingDrafts: number;
  testimonials: number;
  sessions: number;
};

export type RetentionReport = {
  asOf: string;
  enforced: boolean;
  auditPurged: boolean;
  limited: boolean;
  counts: RetentionCounts;
  processed: RetentionCounts;
  note: string;
};

const EMPTY: RetentionCounts = {
  enquiries: 0,
  candidates: 0,
  auditLogs: 0,
  unverifiedAccounts: 0,
  employers: 0,
  matchExplanations: 0,
  outcomeNotes: 0,
  interviewNotes: 0,
  marketingDrafts: 0,
  testimonials: 0,
  sessions: 0,
};

export function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export function candidateWindowDays(status: CandidateStatus | string): number {
  const rules = PRIVACY_POLICY.retention;
  if (status === "REJECTED" || status === "WITHDRAWN") return rules.rejectedApplicationDays;
  if (status === "DEPLOYED") return rules.deployedRecordDays;
  if (status === "APPLIED") return rules.pendingApplicationDays;
  return rules.activeApplicationDays;
}

export function candidateIsDue(input: {
  status: CandidateStatus | string;
  updatedAt: Date;
  redactedAt: Date | null;
  now: Date;
}): boolean {
  if (input.redactedAt) return false;
  const windowDays = candidateWindowDays(input.status);
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

async function purgeAuditPrefix(dueBefore: Date, limit: number): Promise<number> {
  const legacy = await prisma.auditLog.findMany({
    where: { createdAt: { lt: dueBefore }, seq: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  let removed = 0;
  if (legacy.length) {
    const deleted = await prisma.auditLog.deleteMany({ where: { id: { in: legacy.map((row) => row.id) } } });
    removed += deleted.count;
  }
  const remaining = limit - removed;
  if (remaining <= 0) return removed;
  const checkpoint = await prisma.auditCheckpoint.findFirst({ orderBy: { throughSeq: "desc" } });
  let nextSeq = (checkpoint?.throughSeq ?? 0) + 1;
  const prefix: { id: string; seq: number; rowHash: string }[] = [];
  while (prefix.length < remaining) {
    const row = await prisma.auditLog.findFirst({
      where: { seq: nextSeq },
      select: { id: true, seq: true, rowHash: true, createdAt: true },
    });
    if (!row || row.seq == null || !row.rowHash) break;
    if (row.createdAt >= dueBefore) break;
    prefix.push({ id: row.id, seq: row.seq, rowHash: row.rowHash });
    nextSeq += 1;
  }
  if (!prefix.length) return removed;
  const last = prefix[prefix.length - 1];
  await prisma.$transaction([
    prisma.auditCheckpoint.create({
      data: { throughSeq: last.seq, rowHash: last.rowHash, reason: "retention_purge" },
    }),
    prisma.auditLog.deleteMany({ where: { id: { in: prefix.map((row) => row.id) } } }),
  ]);
  return removed + prefix.length;
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
  await reconcileDeletionOutbox(now);

  const enquiryBefore = daysAgo(now, rules.enquiryDays);
  const rejectedBefore = daysAgo(now, rules.rejectedApplicationDays);
  const pendingBefore = daysAgo(now, rules.pendingApplicationDays);
  const activeBefore = daysAgo(now, rules.activeApplicationDays);
  const deployedBefore = daysAgo(now, rules.deployedRecordDays);
  const auditBefore = daysAgo(now, rules.auditLogDays);
  const draftBefore = daysAgo(now, rules.marketingDraftDays);
  const testimonialBefore = daysAgo(now, rules.testimonialRequestDays);
  const sessionBefore = daysAgo(now, rules.sessionDays);
  const cacheBefore = daysAgo(now, rules.embeddingCacheDays);
  const unverifiedBefore = daysAgo(now, rules.unverifiedAccountDays);
  const unverifiedWhere = {
    emailVerifiedAt: null,
    role: { in: ["EMPLOYER", "CANDIDATE"] as ["EMPLOYER", "CANDIDATE"] },
    createdAt: { lt: unverifiedBefore },
  };
  const candidateWhere = {
    redactedAt: null,
    OR: [
      { status: { in: ["REJECTED", "WITHDRAWN"] as CandidateStatus[] }, updatedAt: { lt: rejectedBefore } },
      { status: "APPLIED" as const, updatedAt: { lt: pendingBefore } },
      { status: { in: ACTIVE_STATUSES }, updatedAt: { lt: activeBefore } },
      { status: "DEPLOYED" as const, updatedAt: { lt: deployedBefore } },
    ],
  };
  const employerWhere = {
    redactedAt: null,
    OR: [
      { updatedAt: { lt: activeBefore }, placementOutcomes: { none: {} } },
      { updatedAt: { lt: deployedBefore }, placementOutcomes: { some: {} } },
    ],
  };

  const [
    enquiryCount,
    candidateCount,
    auditCount,
    employerCount,
    matchCount,
    outcomeCount,
    interviewCount,
    draftCount,
    testimonialCount,
    sessionCount,
    unverifiedCount,
  ] = await Promise.all([
    prisma.enquiry.count({ where: { createdAt: { lt: enquiryBefore } } }),
    prisma.candidate.count({ where: candidateWhere }),
    prisma.auditLog.count({ where: { createdAt: { lt: auditBefore } } }),
    prisma.employer.count({ where: employerWhere }),
    prisma.match.count({ where: { createdAt: { lt: deployedBefore }, NOT: { explanation: "" } } }),
    prisma.placementOutcome.count({ where: { createdAt: { lt: deployedBefore }, NOT: { notes: "" } } }),
    prisma.interviewRequest.count({
      where: {
        updatedAt: { lt: deployedBefore },
        OR: [{ staffNote: { not: "" } }, { preferredWindow: { not: "" } }],
      },
    }),
    prisma.marketingDraft.count({
      where: { createdAt: { lt: draftBefore }, NOT: { title: "Redacted draft" } },
    }),
    prisma.testimonialRequest.count({
      where: { status: "REQUESTED", createdAt: { lt: testimonialBefore } },
    }),
    prisma.session.count({
      where: { OR: [{ expiresAt: { lt: sessionBefore } }, { revokedAt: { lt: sessionBefore } }] },
    }),
    prisma.user.count({ where: unverifiedWhere }),
  ]);

  const counts: RetentionCounts = {
    enquiries: enquiryCount,
    candidates: candidateCount,
    auditLogs: auditCount,
    unverifiedAccounts: unverifiedCount,
    employers: employerCount,
    matchExplanations: matchCount,
    outcomeNotes: outcomeCount,
    interviewNotes: interviewCount,
    marketingDrafts: draftCount,
    testimonials: testimonialCount,
    sessions: sessionCount,
  };
  const processed: RetentionCounts = { ...EMPTY };

  if (!enforce) {
    await prisma.embeddingCache.deleteMany({ where: { createdAt: { lt: cacheBefore } } });
    await writeAudit({
      action: "privacy.retention_dry_run",
      entityType: "Retention",
      entityId: now.toISOString(),
      metadata: { ...counts, purgeAudit: false },
      ip: options?.ip ?? "cron",
    });
    return {
      asOf: now.toISOString(),
      enforced: false,
      auditPurged: false,
      limited: Object.values(counts).some((value) => value > RETENTION_BATCH),
      counts,
      processed,
      note: "Dry run. Counts are records past the policy windows. Set RETENTION_ENFORCE=true to redact and delete. Object-store retries still run. See docs/retention.md.",
    };
  }

  const unverifiedUsers = await prisma.user.findMany({
    where: unverifiedWhere,
    select: { id: true, candidate: { select: { id: true, status: true } } },
    orderBy: { createdAt: "asc" },
    take: RETENTION_BATCH,
  });
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

  const [enquiries, candidates, employers, matches, outcomes, interviews, drafts, testimonials, sessions] =
    await Promise.all([
      prisma.enquiry.findMany({
        where: { createdAt: { lt: enquiryBefore } },
        select: { id: true },
        orderBy: { createdAt: "asc" },
        take: RETENTION_BATCH,
      }),
      prisma.candidate.findMany({
        where: candidateWhere,
        select: { id: true },
        orderBy: { updatedAt: "asc" },
        take: RETENTION_BATCH,
      }),
      prisma.employer.findMany({
        where: employerWhere,
        select: { id: true },
        orderBy: { updatedAt: "asc" },
        take: RETENTION_BATCH,
      }),
      prisma.match.findMany({
        where: { createdAt: { lt: deployedBefore }, NOT: { explanation: "" } },
        select: { id: true },
        take: RETENTION_BATCH,
      }),
      prisma.placementOutcome.findMany({
        where: { createdAt: { lt: deployedBefore }, NOT: { notes: "" } },
        select: { id: true },
        take: RETENTION_BATCH,
      }),
      prisma.interviewRequest.findMany({
        where: {
          updatedAt: { lt: deployedBefore },
          OR: [{ staffNote: { not: "" } }, { preferredWindow: { not: "" } }],
        },
        select: { id: true },
        take: RETENTION_BATCH,
      }),
      prisma.marketingDraft.findMany({
        where: { createdAt: { lt: draftBefore }, NOT: { title: "Redacted draft" } },
        select: { id: true },
        take: RETENTION_BATCH,
      }),
      prisma.testimonialRequest.findMany({
        where: { status: "REQUESTED", createdAt: { lt: testimonialBefore } },
        select: { id: true },
        take: RETENTION_BATCH,
      }),
      prisma.session.findMany({
        where: { OR: [{ expiresAt: { lt: sessionBefore } }, { revokedAt: { lt: sessionBefore } }] },
        select: { id: true },
        take: RETENTION_BATCH,
      }),
    ]);

  for (const row of candidates) {
    const result = await redactCandidate({ candidateId: row.id, actorId: null, ip: options?.ip ?? "cron" });
    if (result.ok) processed.candidates += 1;
  }
  for (const row of employers) {
    const result = await redactEmployer({ employerId: row.id, actorId: null, ip: options?.ip ?? "cron" });
    if (result.ok) processed.employers += 1;
  }
  if (enquiries.length) {
    const deleted = await prisma.enquiry.deleteMany({ where: { id: { in: enquiries.map((row) => row.id) } } });
    processed.enquiries = deleted.count;
  }
  if (matches.length) {
    const updated = await prisma.match.updateMany({
      where: { id: { in: matches.map((row) => row.id) } },
      data: { explanation: "" },
    });
    processed.matchExplanations = updated.count;
  }
  if (outcomes.length) {
    const updated = await prisma.placementOutcome.updateMany({
      where: { id: { in: outcomes.map((row) => row.id) } },
      data: { notes: "" },
    });
    processed.outcomeNotes = updated.count;
  }
  if (interviews.length) {
    const updated = await prisma.interviewRequest.updateMany({
      where: { id: { in: interviews.map((row) => row.id) } },
      data: { preferredWindow: "", staffNote: "" },
    });
    processed.interviewNotes = updated.count;
    await prisma.interviewFeedback.updateMany({
      where: { interviewId: { in: interviews.map((row) => row.id) } },
      data: { notes: "", gaps: [] },
    });
  }
  if (drafts.length) {
    const updated = await prisma.marketingDraft.updateMany({
      where: { id: { in: drafts.map((row) => row.id) } },
      data: { title: "Redacted draft", body: "Redacted.", cautions: "" },
    });
    processed.marketingDrafts = updated.count;
  }
  if (testimonials.length) {
    const deleted = await prisma.testimonialRequest.deleteMany({
      where: { id: { in: testimonials.map((row) => row.id) } },
    });
    processed.testimonials = deleted.count;
  }
  if (sessions.length) {
    const deleted = await prisma.session.deleteMany({ where: { id: { in: sessions.map((row) => row.id) } } });
    processed.sessions = deleted.count;
  }
  await prisma.embeddingCache.deleteMany({ where: { createdAt: { lt: cacheBefore } } });

  if (purgeAudit) processed.auditLogs = await purgeAuditPrefix(auditBefore, RETENTION_BATCH);

  await writeAudit({
    action: "privacy.retention_enforce",
    entityType: "Retention",
    entityId: now.toISOString(),
    metadata: {
      enquiryCount,
      candidateCount,
      auditCount,
      unverifiedAccounts: unverifiedCount,
      processedUnverifiedAccounts: processed.unverifiedAccounts,
      processedCandidates: processed.candidates,
      processedEnquiries: processed.enquiries,
      processedAuditLogs: processed.auditLogs,
      purgeAudit,
    },
    ip: options?.ip ?? "cron",
  });

  const limited =
    enquiryCount > enquiries.length ||
    candidateCount > candidates.length ||
    auditCount > RETENTION_BATCH ||
    employerCount > employers.length ||
    unverifiedCount > unverifiedUsers.length;

  return {
    asOf: now.toISOString(),
    enforced: true,
    auditPurged: purgeAudit,
    limited,
    counts,
    processed,
    note: "Due helper and household profiles were redacted. Unconfirmed accounts past the window were removed when they had no file beyond an application. Narrative fields past the deployed window were cleared. Match scores and outcome category codes were kept. Audit rows are removed only when purge is also on, and only as a hash-chain prefix. See docs/retention.md.",
  };
}
