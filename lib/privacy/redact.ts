import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { PDPA_VERSION } from "@/lib/validation/schemas";
import { dropQueued, queueOrDeleteObject } from "@/lib/storage/deletion-outbox";

/** Documented sentinel. This is not a birth date. Redacted profiles are excluded from ranking. */
export const ERASED_DATE = new Date("1900-01-01T00:00:00.000Z");

type RedactResult = { ok: true } | { ok: false; error: string; status: number };

async function removeDocuments(
  documents: { id: string; storageKey: string }[],
  reason: string,
  entityType: string,
  entityId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const queued: string[] = [];
  for (const document of documents) {
    const result = await queueOrDeleteObject({
      storageKey: document.storageKey,
      reason,
      entityType,
      entityId,
    });
    if (!result.ok) {
      await dropQueued(queued);
      return { ok: false, error: "Object deletion could not be queued. The profile was not changed.", status: 503 };
    }
    if (result.outboxId) queued.push(result.outboxId);
  }
  if (documents.length) {
    await prisma.document.deleteMany({ where: { id: { in: documents.map((document) => document.id) } } });
  }
  return { ok: true };
}

async function clearCandidateNarrative(candidateId: string) {
  const interviews = await prisma.interviewRequest.findMany({
    where: { candidateId },
    select: { id: true },
  });
  const interviewIds = interviews.map((row) => row.id);
  await prisma.$transaction([
    prisma.marketingDraft.updateMany({
      where: { candidateId },
      data: { title: "Redacted draft", body: "Redacted.", cautions: "" },
    }),
    prisma.match.updateMany({
      where: { candidateId },
      data: { explanation: "" },
    }),
    prisma.placementOutcome.updateMany({
      where: { candidateId },
      data: { notes: "" },
    }),
    prisma.interviewRequest.updateMany({
      where: { candidateId },
      data: { preferredWindow: "", staffNote: "" },
    }),
    ...(interviewIds.length
      ? [
          prisma.interviewFeedback.updateMany({
            where: { interviewId: { in: interviewIds } },
            data: { notes: "", gaps: [] },
          }),
        ]
      : []),
    prisma.momCase.updateMany({
      where: { match: { candidateId } },
      data: {
        summary: { redacted: true },
        checklist: {},
        rulesSnapshot: { redacted: true },
      },
    }),
  ]);
}

const candidateWipe = {
  fullName: "Redacted profile",
  email: null,
  phone: null,
  nationality: "REDACTED",
  dateOfBirth: ERASED_DATE,
  sex: "UNSPECIFIED" as const,
  educationYears: 0,
  experienceYears: 0,
  skills: { set: [] },
  languages: [] as string[],
  salaryExpectationSgd: 0,
  availableFrom: ERASED_DATE,
  publicBlurb: "",
  householdExperience: "",
  internalNotes: "",
  photoConsent: false,
  marketingConsent: false,
  aiProcessingConsent: false,
  passportNumberEnc: null,
  finEnc: null,
  medicalNotesEnc: null,
  careNeeds: { set: [] },
  skillLevels: {},
  languageLevels: {},
  status: "WITHDRAWN" as const,
};

export async function redactCandidate(input: {
  candidateId: string;
  actorId: string | null;
  ip: string;
}): Promise<RedactResult> {
  const candidate = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    include: { documents: true },
  });
  if (!candidate) return { ok: false, error: "Profile not found", status: 404 };
  if (candidate.redactedAt) return { ok: true };

  const removed = await removeDocuments(candidate.documents, "privacy.redact", "Candidate", candidate.id);
  if (!removed.ok) return removed;

  await clearCandidateNarrative(candidate.id);
  await prisma.$transaction([
    prisma.candidate.update({
      where: { id: candidate.id },
      data: { ...candidateWipe, redactedAt: new Date() },
    }),
    prisma.consentRecord.create({
      data: {
        subjectType: "Candidate",
        subjectId: candidate.id,
        candidateId: candidate.id,
        purpose: "erasure",
        policyVersion: PDPA_VERSION,
        granted: false,
        withdrawnAt: new Date(),
      },
    }),
  ]);
  if (candidate.userId) {
    await prisma.user.update({
      where: { id: candidate.userId },
      data: { disabledAt: new Date(), name: "Redacted", email: `redacted-${candidate.id}@invalid.local` },
    });
    const { revokeAllSessions } = await import("@/lib/auth/sessions");
    await revokeAllSessions({
      userId: candidate.userId,
      reason: "privacy_redact",
      actorId: input.actorId,
      ip: input.ip,
    });
  }
  await writeAudit({
    actorId: input.actorId,
    action: "privacy.redact",
    entityType: "Candidate",
    entityId: candidate.id,
    metadata: { documentsRemoved: candidate.documents.length, subject: "candidate" },
    ip: input.ip,
  });
  return { ok: true };
}

async function anonymiseDraftsMentioning(email: string, fullName: string) {
  const needles = [email.toLowerCase()];
  if (fullName.trim().length >= 8) needles.push(fullName.trim());
  const drafts = await prisma.marketingDraft.findMany({
    select: { id: true, title: true, body: true },
  });
  const ids = drafts
    .filter((draft) => {
      const haystack = `${draft.title}\n${draft.body}`.toLowerCase();
      return needles.some((needle) => needle && haystack.includes(needle.toLowerCase()));
    })
    .map((draft) => draft.id);
  if (!ids.length) return;
  await prisma.marketingDraft.updateMany({
    where: { id: { in: ids } },
    data: { title: "Redacted draft", body: "Redacted.", cautions: "" },
  });
}

export async function redactEmployer(input: {
  employerId: string;
  actorId: string | null;
  ip: string;
}): Promise<RedactResult> {
  const employer = await prisma.employer.findUnique({
    where: { id: input.employerId },
    include: { interviews: { select: { id: true } } },
  });
  if (!employer) return { ok: false, error: "Household not found", status: 404 };
  if (employer.redactedAt) return { ok: true };

  const documents = await prisma.document.findMany({
    where: { employerId: employer.id },
    select: { id: true, storageKey: true },
  });
  const removed = await removeDocuments(documents, "privacy.redact", "Employer", employer.id);
  if (!removed.ok) return removed;

  const interviewIds = employer.interviews.map((row) => row.id);
  await anonymiseDraftsMentioning(employer.email, employer.fullName);
  await prisma.$transaction([
    prisma.employer.update({
      where: { id: employer.id },
      data: {
        fullName: "Redacted household",
        email: `redacted-${employer.id}@invalid.local`,
        phone: "",
        householdSize: 1,
        childrenCount: 0,
        youngestChildAge: null,
        childrenUnder7Count: 0,
        measlesVaccinatedUnder7: null,
        elderlyCount: 0,
        hasPets: false,
        petDetails: null,
        languagesPreferred: [],
        skillsRequired: { set: [] },
        housingType: "REDACTED",
        addressArea: "REDACTED",
        dateOfBirth: ERASED_DATE,
        nricEnc: null,
        notes: "",
        marketingConsent: false,
        aiProcessingConsent: false,
        redactedAt: new Date(),
      },
    }),
    prisma.employerRequirement.updateMany({
      where: { employerId: employer.id },
      data: { title: "Redacted requirement", payload: { redacted: true } },
    }),
    prisma.match.updateMany({
      where: { employerId: employer.id },
      data: { explanation: "" },
    }),
    prisma.placementOutcome.updateMany({
      where: { employerId: employer.id },
      data: { notes: "" },
    }),
    prisma.interviewRequest.updateMany({
      where: { employerId: employer.id },
      data: { preferredWindow: "", staffNote: "" },
    }),
    ...(interviewIds.length
      ? [
          prisma.interviewFeedback.updateMany({
            where: { interviewId: { in: interviewIds } },
            data: { notes: "", gaps: [] },
          }),
        ]
      : []),
    prisma.consentRecord.create({
      data: {
        subjectType: "Employer",
        subjectId: employer.id,
        purpose: "erasure",
        policyVersion: PDPA_VERSION,
        granted: false,
        withdrawnAt: new Date(),
      },
    }),
  ]);
  if (employer.userId) {
    await prisma.user.update({
      where: { id: employer.userId },
      data: { disabledAt: new Date(), name: "Redacted", email: `redacted-${employer.id}@invalid.local` },
    });
    const { revokeAllSessions } = await import("@/lib/auth/sessions");
    await revokeAllSessions({
      userId: employer.userId,
      reason: "privacy_redact",
      actorId: input.actorId,
      ip: input.ip,
    });
  }
  await writeAudit({
    actorId: input.actorId,
    action: "privacy.redact",
    entityType: "Employer",
    entityId: employer.id,
    metadata: { documentsRemoved: documents.length, subject: "employer" },
    ip: input.ip,
  });
  return { ok: true };
}
