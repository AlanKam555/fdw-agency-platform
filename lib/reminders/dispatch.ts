import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { createEmailDriver, emailDriverName, unsubscribeUrl } from "@/lib/email/driver";
import { logEvent } from "@/lib/log";
import { brand } from "@/config/brand";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  includeHelperEmail,
  reminderKindForCode,
  reminderLabel,
  remindersWillSend,
  type ReminderTypeCode,
} from "@/lib/reminders/catalog";
import { dueKey } from "@/lib/reminders/schedule";

const PER_RUN = 20;
const PER_RECIPIENT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

type Job = {
  entityId: string;
  reminderId: string | null;
  kind: ReminderTypeCode;
  title: string;
  dueOn: string;
  approved: boolean;
  recipients: string[];
};

export type DispatchSummary = {
  ok: true;
  dryRun: boolean;
  driver: string;
  considered: number;
  recorded: number;
  sent: number;
  skipped: number;
  failed: number;
  duplicates: number;
};

function pepper(): string {
  return process.env.AUTH_SECRET || "reminder";
}

export function recipientHash(email: string): string {
  return createHash("sha256").update(`${pepper()}\n${email.trim().toLowerCase()}`).digest("hex");
}

export function dedupeKey(input: { kind: string; entityId: string; email: string; dueOn: string }): string {
  return createHash("sha256")
    .update(`${input.kind}|${input.entityId}|${input.email.trim().toLowerCase()}|${input.dueOn}`)
    .digest("hex");
}

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  if (!email.includes("@")) return null;
  return email;
}

function messageText(input: { title: string; dueOn: string; unsubscribe: string }): string {
  return [
    `${brand.name} reminder`,
    "",
    input.title,
    input.dueOn === "open" ? "No calendar date is recorded yet." : `Due date on file: ${input.dueOn}.`,
    "",
    "This is a staff follow-up. It is not a filing with the Ministry of Manpower, and it does not change a work permit.",
    "",
    `To stop these reminders: ${input.unsubscribe}`,
  ].join("\n");
}

async function jobs(): Promise<Job[]> {
  const [reminders, interviews, staffInbox] = await Promise.all([
    prisma.reminder.findMany({
      where: { done: false },
      orderBy: { id: "asc" },
      take: 100,
      include: { momCase: { include: { match: { include: { employer: true, candidate: true } } } } },
    }),
    prisma.interviewRequest.findMany({
      where: { status: "REQUESTED", createdAt: { gte: new Date(Date.now() - 14 * DAY_MS) } },
      orderBy: { id: "asc" },
      take: 50,
      include: { employer: true, candidate: true },
    }),
    Promise.resolve(process.env.EMAIL_STAFF_INBOX?.trim().toLowerCase() ?? ""),
  ]);

  const helperMail = includeHelperEmail();
  const rows: Job[] = [];
  for (const reminder of reminders) {
    const kind = reminderKindForCode(reminder.kind || reminder.code);
    if (!kind) continue;
    const employer = normalizeEmail(reminder.momCase.match.employer.email);
    const helper = helperMail ? normalizeEmail(reminder.momCase.match.candidate.email) : null;
    const recipients = [employer, helper].filter((item): item is string => Boolean(item));
    if (!recipients.length) continue;
    rows.push({
      entityId: reminder.id,
      reminderId: reminder.id,
      kind,
      title: reminder.title,
      dueOn: reminder.dueOn ? dueKey(reminder.dueOn) : "open",
      approved: Boolean(reminder.approvedAt),
      recipients,
    });
  }
  for (const interview of interviews) {
    const recipients = [normalizeEmail(interview.employer.email), staffInbox.includes("@") ? staffInbox : null].filter(
      (item): item is string => Boolean(item),
    );
    const unique = [...new Set(recipients)];
    if (!unique.length) continue;
    rows.push({
      entityId: interview.id,
      reminderId: null,
      kind: "interview_request",
      title: "Interview request is still open",
      dueOn: dueKey(interview.createdAt),
      approved: false,
      recipients: unique,
    });
  }
  return rows;
}

export async function dispatchReminders(): Promise<DispatchSummary> {
  const dryRun = !remindersWillSend();
  const driverName = emailDriverName();
  const summary: DispatchSummary = {
    ok: true,
    dryRun,
    driver: driverName,
    considered: 0,
    recorded: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    duplicates: 0,
  };
  const optIns = await prisma.reminderTypeOptIn.findMany();
  const enabled = new Set(optIns.filter((row) => row.enabled).map((row) => row.code));
  const suppressions = new Set((await prisma.emailSuppression.findMany({ select: { emailHash: true } })).map((row) => row.emailHash));
  const pending = await jobs();
  let sentThisRun = 0;
  const driver = dryRun ? null : await createEmailDriver().catch((error: unknown) => {
    logEvent("error", "email.driver_unavailable", { driver: driverName });
    summary.failed += 1;
    summary.skipped += pending.length;
    void error;
    return null;
  });
  if (!dryRun && !driver) {
    logEvent("info", "reminder.dispatch", {
      dryRun,
      driver: driverName,
      considered: summary.considered,
      recorded: summary.recorded,
      sent: summary.sent,
      skipped: summary.skipped,
      failed: summary.failed,
    });
    return summary;
  }

  for (const job of pending) {
    for (const email of job.recipients) {
      summary.considered += 1;
      if (sentThisRun >= PER_RUN) {
        summary.skipped += 1;
        continue;
      }
      const allowed = enabled.has(job.kind) || job.approved;
      if (!allowed) {
        summary.skipped += 1;
        continue;
      }
      const hash = recipientHash(email);
      if (suppressions.has(hash)) {
        summary.skipped += 1;
        continue;
      }
      const key = dedupeKey({ kind: job.kind, entityId: job.entityId, email, dueOn: job.dueOn });
      const existing = await prisma.reminderDelivery.findUnique({ where: { dedupeKey: key } });
      if (existing?.status === "sent" || (existing?.status === "dry_run" && dryRun)) {
        summary.duplicates += 1;
        continue;
      }
      if (dryRun) {
        if (!existing) {
          await prisma.reminderDelivery.create({
            data: {
              dedupeKey: key,
              reminderId: job.reminderId,
              kind: job.kind,
              dueOn: job.dueOn,
              recipientHash: hash,
              status: "dry_run",
              driver: driverName,
            },
          });
        }
        summary.recorded += 1;
        sentThisRun += 1;
        continue;
      }
      const limit = await consumeRateLimit(`reminder:${hash}`, PER_RECIPIENT, DAY_MS);
      if (!limit.ok) {
        summary.skipped += 1;
        continue;
      }
      const text = messageText({
        title: job.title,
        dueOn: job.dueOn,
        unsubscribe: unsubscribeUrl(email, process.env.APP_URL || "http://localhost:3000"),
      });
      try {
        await driver!.send({
          to: email,
          subject: `${brand.name}: ${reminderLabel(job.kind)}`,
          text,
          template: job.kind,
          headers: { "List-Unsubscribe": unsubscribeUrl(email, process.env.APP_URL || "http://localhost:3000") },
        });
        if (existing) {
          await prisma.reminderDelivery.update({
            where: { id: existing.id },
            data: { status: "sent", driver: driverName },
          });
        } else {
          await prisma.reminderDelivery.create({
            data: {
              dedupeKey: key,
              reminderId: job.reminderId,
              kind: job.kind,
              dueOn: job.dueOn,
              recipientHash: hash,
              status: "sent",
              driver: driverName,
            },
          });
        }
        summary.sent += 1;
        summary.recorded += 1;
        sentThisRun += 1;
        await writeAudit({
          action: "reminder.deliver",
          entityType: job.reminderId ? "Reminder" : "InterviewRequest",
          entityId: job.entityId,
          metadata: { kind: job.kind, status: "sent", driver: driverName, dueOn: job.dueOn },
        });
      } catch {
        summary.failed += 1;
        logEvent("error", "reminder.deliver_failed", { driver: driverName, template: job.kind });
      }
    }
  }

  await writeAudit({
    action: "reminder.dispatch",
    entityType: "Reminder",
    entityId: "cron",
    metadata: {
      dryRun,
      driver: driverName,
      considered: summary.considered,
      recorded: summary.recorded,
      sent: summary.sent,
      skipped: summary.skipped,
      failed: summary.failed,
      duplicates: summary.duplicates,
    },
  });
  logEvent("info", "reminder.dispatch", {
    dryRun,
    driver: driverName,
    considered: summary.considered,
    recorded: summary.recorded,
    sent: summary.sent,
    skipped: summary.skipped,
    failed: summary.failed,
    duplicates: summary.duplicates,
  });
  return summary;
}

export async function suppressEmail(email: string): Promise<void> {
  const emailHash = recipientHash(email);
  await prisma.emailSuppression.upsert({
    where: { emailHash },
    create: { emailHash },
    update: {},
  });
  await writeAudit({
    action: "reminder.unsubscribe",
    entityType: "EmailSuppression",
    entityId: emailHash.slice(0, 16),
    metadata: { digest: emailHash.slice(0, 12) },
  });
}
