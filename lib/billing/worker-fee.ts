import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { assessWorkerAgencyFee, sgdFromCents } from "@/lib/mom/compliance";
import { effectiveMomRules } from "@/lib/mom/effective-rules";

export async function recordWorkerFee(input: {
  candidateId: string;
  monthlySalaryCents: number;
  contractMonths: number;
  workPassMonths: number;
  feeCents: number;
  actorId: string;
  ip: string;
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    select: { id: true },
  });
  if (!candidate) return { ok: false as const, error: "Helper not found.", capCents: 0 };

  const rules = await effectiveMomRules();
  const assessment = assessWorkerAgencyFee(input, rules);
  if (!assessment.ok) {
    await writeAudit({
      actorId: input.actorId,
      action: "billing.worker_fee_refused",
      entityType: "WorkerFee",
      entityId: input.candidateId,
      metadata: { capCents: assessment.capCents, overByCents: assessment.overByCents },
      ip: input.ip,
    });
    return { ok: false as const, error: assessment.warning ?? "That fee is above the cap.", capCents: assessment.capCents };
  }

  const row = await prisma.workerFee.create({
    data: {
      candidateId: input.candidateId,
      monthlySalaryCents: input.monthlySalaryCents,
      contractMonths: input.contractMonths,
      workPassMonths: input.workPassMonths,
      feeCents: input.feeCents,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "billing.worker_fee_record",
    entityType: "WorkerFee",
    entityId: row.id,
    metadata: {
      capCents: assessment.capCents,
      feeCents: assessment.feeCents,
      earlyTerminationRefundCents: assessment.earlyTerminationRefundCents,
    },
    ip: input.ip,
  });
  return {
    ok: true as const,
    id: row.id,
    capCents: assessment.capCents,
    earlyTerminationRefundCents: assessment.earlyTerminationRefundCents,
    note: `Recorded S$${sgdFromCents(assessment.feeCents)}. The cap is S$${sgdFromCents(assessment.capCents)}. If the employer terminates within ${rules.eaFee.earlyTerminationWithinMonths} months, the MOM limit is a ${rules.eaFee.earlyTerminationRefundPercent}% refund of the agency fee collected (S$${sgdFromCents(assessment.earlyTerminationRefundCents)}).`,
  };
}
