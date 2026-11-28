import type { CandidateStatus, Prisma, Skill } from "@prisma/client";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { encryptString } from "@/lib/crypto/field-encryption";
import { toMatchable, toPublicCandidate } from "@/lib/candidates/dto";
import { assertTransition, type PipelineStatus } from "@/lib/candidates/status";
import { hashPassword } from "@/lib/security/passwords";
import { issueEmailVerification } from "@/lib/security/email-verification";
import {
  PDPA_VERSION,
  type candidateApplicationSchema,
  type publicCandidateApplicationSchema,
} from "@/lib/validation/schemas";
import type { z } from "zod";

type ApplicationInput = z.infer<typeof candidateApplicationSchema> | z.infer<typeof publicCandidateApplicationSchema>;

function optionalCipher(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return encryptString(trimmed);
}

export async function createCandidateApplication(
  input: ApplicationInput,
  context: { ip: string; actorId?: string | null; userId?: string | null; fictional?: boolean },
) {
  let userId = context.userId ?? null;
  if (!userId && input.password) {
    const email = input.email.toLowerCase();
    const passwordHash = await hashPassword(input.password);
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!existing.emailVerifiedAt && (existing.role === "EMPLOYER" || existing.role === "CANDIDATE")) {
        await issueEmailVerification(existing.id, email);
      }
      return {
        ok: false as const,
        code: "duplicate_email" as const,
        error: "An account with this email already exists. Sign in to continue the application.",
      };
    }
    const user = await prisma.user.create({
      data: {
        email,
        name: input.fullName,
        role: "CANDIDATE",
        passwordHash,
      },
    });
    await issueEmailVerification(user.id, email);
    userId = user.id;
  }

  const candidate = await prisma.candidate.create({
    data: {
      userId,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      nationality: input.nationality,
      dateOfBirth: input.dateOfBirth,
      sex: input.sex,
      educationYears: input.educationYears,
      experienceYears: input.experienceYears,
      skills: input.skills,
      languages: input.languages,
      salaryExpectationSgd: input.salaryExpectationSgd,
      availableFrom: input.availableFrom,
      householdExperience: input.householdExperience,
      internalNotes: "internalNotes" in input ? (input.internalNotes ?? "") : "",
      photoConsent: input.photoConsent,
      fictional: context.fictional ?? false,
      firstTimeInSingapore: input.firstTimeInSingapore,
      pdpaConsentAt: new Date(),
      pdpaConsentVersion: PDPA_VERSION,
      passportNumberEnc: optionalCipher(input.passportNumber),
      medicalNotesEnc: optionalCipher(input.medicalNotes),
      medicalFitStatus: "medicalFitStatus" in input ? input.medicalFitStatus : "PENDING",
      status: "APPLIED",
      consents: {
        create: [
          {
            subjectType: "Candidate",
            subjectId: "pending",
            purpose: "application_processing",
            policyVersion: PDPA_VERSION,
            granted: true,
          },
          ...(input.photoConsent
            ? [
                {
                  subjectType: "Candidate",
                  subjectId: "pending",
                  purpose: "photo_publication",
                  policyVersion: PDPA_VERSION,
                  granted: true,
                },
              ]
            : []),
        ],
      },
    },
  });

  await prisma.consentRecord.updateMany({
    where: { candidateId: candidate.id, subjectId: "pending" },
    data: { subjectId: candidate.id },
  });

  await writeAudit({
    actorId: context.actorId ?? userId,
    action: "candidate.create",
    entityType: "Candidate",
    entityId: candidate.id,
    metadata: { status: candidate.status, photoConsent: candidate.photoConsent },
    ip: context.ip,
  });

  return { ok: true as const, candidate };
}

export async function changeCandidateStatus(input: {
  candidateId: string;
  status: CandidateStatus;
  actorId: string;
  ip: string;
}) {
  const candidate = await prisma.candidate.findUnique({ where: { id: input.candidateId } });
  if (!candidate || candidate.redactedAt) {
    return { ok: false as const, error: "Profile not found" };
  }
  try {
    assertTransition(candidate.status as PipelineStatus, input.status as PipelineStatus);
  } catch (error) {
    return { ok: false as const, error: error instanceof Error ? error.message : "Invalid status" };
  }
  const updated = await prisma.candidate.update({
    where: { id: candidate.id },
    data: { status: input.status },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "candidate.status_change",
    entityType: "Candidate",
    entityId: candidate.id,
    metadata: { from: candidate.status, to: input.status },
    ip: input.ip,
  });
  return { ok: true as const, candidate: updated };
}

export async function listPublicHelpers(filters: {
  skill?: string;
  language?: string;
  maxSalary?: number;
}) {
  const where: Prisma.CandidateWhereInput = {
    status: "AVAILABLE",
    photoConsent: true,
    redactedAt: null,
  };
  const skills: Skill[] = [
    "INFANT_CARE",
    "CHILD_CARE",
    "ELDERLY_CARE",
    "COOKING",
    "HOUSEKEEPING",
    "PET_CARE",
    "SPECIAL_NEEDS",
    "DRIVING",
  ];
  if (filters.skill && skills.includes(filters.skill as Skill)) {
    where.skills = { has: filters.skill as Skill };
  }
  if (filters.language) where.languages = { has: filters.language };
  if (filters.maxSalary) where.salaryExpectationSgd = { lte: filters.maxSalary };
  const rows = await prisma.candidate.findMany({
    where,
    include: { documents: { select: { kind: true } } },
    orderBy: { availableFrom: "asc" },
    take: 24,
  });
  return rows.map(toPublicCandidate);
}

export async function getPublicHelper(id: string) {
  const row = await prisma.candidate.findFirst({
    where: { id, status: "AVAILABLE", photoConsent: true, redactedAt: null },
    include: { documents: { select: { kind: true } } },
  });
  return row ? toPublicCandidate(row) : null;
}

export function candidateMatchView(candidate: Parameters<typeof toMatchable>[0]) {
  return toMatchable(candidate);
}
