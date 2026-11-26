import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { momRules } from "@/config/mom-rules";
import { buildChecklist, reminderSeeds, type MomPackInput } from "@/lib/mom/checklist";
import { renderMomPdf } from "@/lib/mom/pdf";
import type { momAttestationSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

type Attestation = z.infer<typeof momAttestationSchema>;

export async function prepareMomCase(input: {
  matchId: string;
  attestation: Attestation;
  actorId: string;
  ip: string;
}) {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    include: { candidate: true, employer: true },
  });
  if (!match) return { ok: false as const, error: "Match not found" };
  if (match.decision !== "STAFF_APPROVED") {
    return { ok: false as const, error: "Prepare a MOM pack only after staff approve the match." };
  }

  const packInput: MomPackInput = {
    fdw: {
      fullName: match.candidate.fullName,
      dateOfBirth: match.candidate.dateOfBirth,
      nationality: match.candidate.nationality,
      educationYears: match.candidate.educationYears,
      sex: match.candidate.sex,
      firstTimeInSingapore: match.candidate.firstTimeInSingapore,
      salaryExpectationSgd: match.candidate.salaryExpectationSgd,
    },
    employer: {
      fullName: match.employer.fullName,
      dateOfBirth: match.employer.dateOfBirth,
      isUndischargedBankrupt: match.employer.isUndischargedBankrupt,
      firstTimeEmployer: match.employer.firstTimeEmployer,
      eopCompleted: match.employer.eopCompleted,
      eopCompletedOn: match.employer.eopCompletedOn,
      childrenUnder7Count: match.employer.childrenUnder7Count,
      measlesVaccinatedUnder7: match.employer.measlesVaccinatedUnder7,
      addressArea: match.employer.addressArea,
    },
    attestation: input.attestation,
  };
  const checklist = buildChecklist(packInput, momRules);
  const reminders = reminderSeeds(checklist.items);

  const momCase = await prisma.momCase.upsert({
    where: { matchId: match.id },
    create: {
      matchId: match.id,
      checklist: checklist.items,
      summary: {
        helperName: match.candidate.fullName,
        employerName: match.employer.fullName,
        salaryAgreedSgd: input.attestation.salaryAgreedSgd,
        restDaysPerMonth: input.attestation.restDaysPerMonth,
        proposedSubmissionDate: input.attestation.proposedSubmissionDate.toISOString(),
        portal: "Staff submit on MOM WP Online with Singpass or CorpPass. This product does not submit.",
      },
      rulesSnapshot: momRules,
      ready: checklist.ready,
      reminders: { create: reminders },
    },
    update: {
      checklist: checklist.items,
      summary: {
        helperName: match.candidate.fullName,
        employerName: match.employer.fullName,
        salaryAgreedSgd: input.attestation.salaryAgreedSgd,
        restDaysPerMonth: input.attestation.restDaysPerMonth,
        proposedSubmissionDate: input.attestation.proposedSubmissionDate.toISOString(),
        portal: "Staff submit on MOM WP Online with Singpass or CorpPass. This product does not submit.",
      },
      rulesSnapshot: momRules,
      ready: checklist.ready,
      reminders: { deleteMany: {}, create: reminders },
    },
  });

  await writeAudit({
    actorId: input.actorId,
    action: "mom.pack_generate",
    entityType: "MomCase",
    entityId: momCase.id,
    metadata: { ready: momCase.ready, matchId: match.id },
    ip: input.ip,
  });

  return { ok: true as const, momCase };
}

export async function momPdf(matchId: string) {
  const momCase = await prisma.momCase.findUnique({
    where: { matchId },
    include: { match: { include: { candidate: true, employer: true } } },
  });
  if (!momCase) return null;
  const items = momCase.checklist as Parameters<typeof renderMomPdf>[0]["items"];
  const bytes = await renderMomPdf({
    agencyName: "Harbourlight Agency",
    helperName: momCase.match.candidate.fullName,
    employerName: momCase.match.employer.fullName,
    generatedOn: new Date().toISOString(),
    ready: momCase.ready,
    items,
    rules: momRules,
  });
  return { bytes, fileName: `mom-pack-${matchId}.pdf` };
}
