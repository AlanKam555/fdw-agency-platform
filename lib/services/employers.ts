import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { encryptString } from "@/lib/crypto/field-encryption";
import { experienceTarget } from "@/lib/matching/score";
import type { EmployerRequest } from "@/lib/matching/types";
import { PDPA_VERSION, type employerRequirementSchema } from "@/lib/validation/schemas";
import type { z } from "zod";

export type RequirementInput = z.infer<typeof employerRequirementSchema>;

export function snapshotFromEmployer(input: RequirementInput): EmployerRequest {
  return {
    id: "draft",
    skillsRequired: input.skillsRequired,
    languagesPreferred: input.languagesPreferred,
    experienceTargetYears: experienceTarget({
      childrenCount: input.childrenCount,
      elderlyCount: input.elderlyCount,
      hasPets: input.hasPets,
    }),
    budgetMinSgd: input.budgetMinSgd,
    budgetMaxSgd: input.budgetMaxSgd,
    startDate: input.startDate,
  };
}

export async function saveEmployerRequirement(
  input: RequirementInput,
  context: { userId?: string | null; actorId?: string | null; ip: string; kind: "account" | "enquiry" },
) {
  if (context.kind === "enquiry") {
    const enquiry = await prisma.enquiry.create({
      data: {
        kind: "employer",
        name: input.fullName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        message: input.notes || "Employer requirement enquiry",
        payload: {
          householdSize: input.householdSize,
          childrenCount: input.childrenCount,
          elderlyCount: input.elderlyCount,
          hasPets: input.hasPets,
          languagesPreferred: input.languagesPreferred,
          skillsRequired: input.skillsRequired,
          budgetMinSgd: input.budgetMinSgd,
          budgetMaxSgd: input.budgetMaxSgd,
          startDate: input.startDate.toISOString(),
          housingType: input.housingType,
          addressArea: input.addressArea,
        },
      },
    });
    await writeAudit({
      actorId: context.actorId,
      action: "enquiry.employer",
      entityType: "Enquiry",
      entityId: enquiry.id,
      ip: context.ip,
    });
    return { ok: true as const, enquiryId: enquiry.id, requirementId: null as string | null };
  }

  if (!context.userId) {
    return { ok: false as const, error: "Sign in as an employer to save a requirement." };
  }

  const nric = input.nric?.trim();
  const employer = await prisma.employer.upsert({
    where: { userId: context.userId },
    create: {
      userId: context.userId,
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      householdSize: input.householdSize,
      childrenCount: input.childrenCount,
      youngestChildAge: input.youngestChildAge ?? null,
      childrenUnder7Count: input.childrenUnder7Count,
      measlesVaccinatedUnder7: input.measlesVaccinatedUnder7,
      elderlyCount: input.elderlyCount,
      hasPets: input.hasPets,
      petDetails: input.petDetails || null,
      languagesPreferred: input.languagesPreferred,
      skillsRequired: input.skillsRequired,
      budgetMinSgd: input.budgetMinSgd,
      budgetMaxSgd: input.budgetMaxSgd,
      startDate: input.startDate,
      housingType: input.housingType,
      addressArea: input.addressArea,
      dateOfBirth: input.dateOfBirth ?? null,
      nricEnc: nric ? encryptString(nric) : null,
      isUndischargedBankrupt: input.isUndischargedBankrupt,
      firstTimeEmployer: input.firstTimeEmployer,
      eopCompleted: input.eopCompleted,
      eopCompletedOn: input.eopCompleted ? input.eopCompletedOn ?? null : null,
      notes: input.notes,
      pdpaConsentAt: new Date(),
      pdpaConsentVersion: PDPA_VERSION,
    },
    update: {
      fullName: input.fullName,
      email: input.email.toLowerCase(),
      phone: input.phone,
      householdSize: input.householdSize,
      childrenCount: input.childrenCount,
      youngestChildAge: input.youngestChildAge ?? null,
      childrenUnder7Count: input.childrenUnder7Count,
      measlesVaccinatedUnder7: input.measlesVaccinatedUnder7,
      elderlyCount: input.elderlyCount,
      hasPets: input.hasPets,
      petDetails: input.petDetails || null,
      languagesPreferred: input.languagesPreferred,
      skillsRequired: input.skillsRequired,
      budgetMinSgd: input.budgetMinSgd,
      budgetMaxSgd: input.budgetMaxSgd,
      startDate: input.startDate,
      housingType: input.housingType,
      addressArea: input.addressArea,
      dateOfBirth: input.dateOfBirth ?? null,
      nricEnc: nric ? encryptString(nric) : undefined,
      isUndischargedBankrupt: input.isUndischargedBankrupt,
      firstTimeEmployer: input.firstTimeEmployer,
      eopCompleted: input.eopCompleted,
      eopCompletedOn: input.eopCompleted ? input.eopCompletedOn ?? null : null,
      notes: input.notes,
    },
  });

  const snapshot = snapshotFromEmployer(input);
  const requirement = await prisma.employerRequirement.create({
    data: {
      employerId: employer.id,
      title: input.title || `Requirement ${new Date().toISOString().slice(0, 10)}`,
      payload: { ...snapshot, startDate: snapshot.startDate.toISOString(), id: undefined },
    },
  });

  await prisma.consentRecord.create({
    data: {
      subjectType: "Employer",
      subjectId: employer.id,
      purpose: "requirement_matching",
      policyVersion: PDPA_VERSION,
      granted: true,
    },
  });

  await writeAudit({
    actorId: context.actorId ?? context.userId,
    action: "employer.requirement",
    entityType: "EmployerRequirement",
    entityId: requirement.id,
    ip: context.ip,
  });

  return { ok: true as const, enquiryId: null as string | null, requirementId: requirement.id };
}

export function requestFromPayload(id: string, payload: unknown): EmployerRequest | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Partial<EmployerRequest> & { startDate?: string };
  if (
    !Array.isArray(value.skillsRequired) ||
    !Array.isArray(value.languagesPreferred) ||
    typeof value.budgetMaxSgd !== "number" ||
    typeof value.experienceTargetYears !== "number" ||
    !value.startDate
  ) {
    return null;
  }
  const extra = value as EmployerRequest;
  return {
    id,
    skillsRequired: value.skillsRequired,
    languagesPreferred: value.languagesPreferred,
    experienceTargetYears: value.experienceTargetYears,
    budgetMinSgd: value.budgetMinSgd ?? 0,
    budgetMaxSgd: value.budgetMaxSgd,
    startDate: new Date(value.startDate),
    householdNotes: typeof extra.householdNotes === "string" ? extra.householdNotes : "",
    careNeeds: Array.isArray(extra.careNeeds) ? extra.careNeeds.map(String) : [],
    skillMinimums: levelRecord(extra.skillMinimums),
    languageMinimums: levelRecord(extra.languageMinimums),
    placementPreference: placementPreference(extra.placementPreference),
  };
}

function levelRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const allowed = new Set(["BASIC", "INTERMEDIATE", "ADVANCED"]);
  const result: Record<string, "BASIC" | "INTERMEDIATE" | "ADVANCED"> = {};
  for (const [key, level] of Object.entries(value)) {
    if (typeof level === "string" && allowed.has(level)) {
      result[key] = level as "BASIC" | "INTERMEDIATE" | "ADVANCED";
    }
  }
  return result;
}

function placementPreference(value: unknown) {
  if (value === "NEW_HIRE" || value === "TRANSFER" || value === "RETURNING" || value === "ANY") return value;
  return "ANY" as const;
}
