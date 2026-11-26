import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { deleteObject } from "@/lib/storage/files";
import { draftMarketingCopy, type PublicBlurbInput } from "@/lib/ai/drafts";
import { checkAdvertisement, complianceFooter, withComplianceFooter } from "@/lib/marketing/compliance";
import { agencyProfile } from "@/lib/services/agency";
import { PDPA_VERSION } from "@/lib/validation/schemas";

export async function addShortlist(input: {
  userId: string;
  candidateId: string;
  ip: string;
}) {
  const employer = await prisma.employer.findUnique({ where: { userId: input.userId } });
  if (!employer) return { ok: false as const, error: "Save your household requirements before shortlisting." };
  const candidate = await prisma.candidate.findFirst({
    where: {
      id: input.candidateId,
      status: "AVAILABLE",
      photoConsent: true,
      redactedAt: null,
    },
  });
  if (!candidate) return { ok: false as const, error: "That profile is not available to shortlist." };
  await prisma.shortlist.upsert({
    where: {
      employerId_candidateId: { employerId: employer.id, candidateId: candidate.id },
    },
    create: { employerId: employer.id, candidateId: candidate.id },
    update: {},
  });
  await writeAudit({
    actorId: input.userId,
    action: "employer.shortlist",
    entityType: "Candidate",
    entityId: candidate.id,
    ip: input.ip,
  });
  return { ok: true as const };
}

export async function requestInterview(input: {
  userId: string;
  candidateId: string;
  preferredWindow: string;
  ip: string;
}) {
  const employer = await prisma.employer.findUnique({ where: { userId: input.userId } });
  if (!employer) return { ok: false as const, error: "Save your household requirements first." };
  const candidate = await prisma.candidate.findFirst({
    where: { id: input.candidateId, status: "AVAILABLE", redactedAt: null, photoConsent: true },
  });
  if (!candidate) return { ok: false as const, error: "That profile is not open for interviews." };
  const interview = await prisma.interviewRequest.create({
    data: {
      employerId: employer.id,
      candidateId: candidate.id,
      preferredWindow: input.preferredWindow,
    },
  });
  await writeAudit({
    actorId: input.userId,
    action: "interview.request",
    entityType: "InterviewRequest",
    entityId: interview.id,
    metadata: { candidateId: candidate.id },
    ip: input.ip,
  });
  return { ok: true as const, interview };
}

export async function createMarketingDraft(input: {
  authorId: string;
  kind: "SOCIAL_POST" | "AD_COPY" | "PROFILE_BLURB" | "CAMPAIGN_COPY" | "BLOG_ARTICLE" | "NEWSLETTER" | "HEADLINE" | "SEO_PAGE";
  candidateId?: string;
  notes: string;
  language?: string;
  channel?: string;
  campaignId?: string;
  ip: string;
}) {
  let facts: PublicBlurbInput = {
    fullName: "Harbourlight helpers",
    nationality: "approved source countries",
    experienceYears: 0,
    skills: [],
    languages: ["English"],
    householdExperience: "",
    notes: input.notes,
    language: input.language,
    channel: input.channel,
  };
  if (input.candidateId) {
    const candidate = await prisma.candidate.findUnique({ where: { id: input.candidateId } });
    if (!candidate || candidate.redactedAt) return { ok: false as const, error: "Profile not found" };
    facts = {
      fullName: candidate.fullName,
      nationality: candidate.nationality,
      experienceYears: candidate.experienceYears,
      skills: candidate.skills,
      languages: candidate.languages,
      householdExperience: candidate.householdExperience,
      notes: input.notes,
      language: input.language,
      channel: input.channel,
    };
  }
  if (input.campaignId) {
    const campaign = await prisma.campaign.findUnique({ where: { id: input.campaignId } });
    if (!campaign) return { ok: false as const, error: "Campaign not found" };
  }
  const profile = await agencyProfile();
  facts.brandVoice = profile.brandVoice;
  const draft = await draftMarketingCopy(input.kind, facts);
  const footer = complianceFooter({
    agencyName: profile.name,
    licenceNo: profile.eaLicenceNo,
    personnel: profile.personnel,
    fictional: profile.eaLicenceNo === "00C0000",
  });
  const body = withComplianceFooter(draft.body, footer);
  const compliance = checkAdvertisement({
    body,
    licenceNo: profile.eaLicenceNo,
    personnelNumbers: profile.personnel.map((person) => person.registrationNo),
  });
  const cautions = [
    draft.cautions,
    compliance.ok ? "Compliance check found no blocking issues. Staff still approve before any use." : compliance.blocking.map((issue) => issue.detail).join(" "),
    "Export or copy only. This product does not post to Facebook, Instagram, TikTok, WhatsApp, Google, or email.",
  ]
    .filter(Boolean)
    .join(" ");
  const variantGroup = input.kind === "HEADLINE" ? randomUUID() : "";
  const saved = await prisma.marketingDraft.create({
    data: {
      kind: input.kind,
      title: draft.title,
      body,
      cautions,
      source: draft.source,
      status: "DRAFT",
      authorId: input.authorId,
      candidateId: input.candidateId,
      channel: input.channel ?? "",
      language: input.language ?? "en",
      variantGroup,
      compliance,
      campaignId: input.campaignId,
    },
  });
  if (input.kind === "HEADLINE") {
    const lines = draft.body.split("\n").map((line) => line.trim()).filter(Boolean);
    const alternate = withComplianceFooter(lines[1] || `${draft.title} — variant B`, footer);
    const alternateCheck = checkAdvertisement({
      body: alternate,
      licenceNo: profile.eaLicenceNo,
      personnelNumbers: profile.personnel.map((person) => person.registrationNo),
    });
    await prisma.marketingDraft.create({
      data: {
        kind: "HEADLINE",
        title: `${draft.title} (B)`,
        body: alternate,
        cautions,
        source: draft.source,
        status: "DRAFT",
        authorId: input.authorId,
        channel: input.channel ?? "",
        language: input.language ?? "en",
        variantGroup,
        compliance: alternateCheck,
        campaignId: input.campaignId,
      },
    });
  }
  await writeAudit({
    actorId: input.authorId,
    action: "marketing.draft",
    entityType: "MarketingDraft",
    entityId: saved.id,
    metadata: { kind: input.kind, source: draft.source },
    ip: input.ip,
  });
  return { ok: true as const, draft: saved };
}

export async function reviewMarketingDraft(input: {
  draftId: string;
  reviewerId: string;
  decision: "APPROVED" | "REJECTED";
  ip: string;
}) {
  const draft = await prisma.marketingDraft.findUnique({ where: { id: input.draftId } });
  if (!draft || draft.status !== "DRAFT") {
    return { ok: false as const, error: "Only a draft waiting for review can be decided." };
  }
  if (input.decision === "APPROVED") {
    const profile = await agencyProfile();
    const compliance = checkAdvertisement({
      body: draft.body,
      licenceNo: profile.eaLicenceNo,
      personnelNumbers: profile.personnel.map((person) => person.registrationNo),
    });
    if (!compliance.ok) {
      return {
        ok: false as const,
        error: `Compliance blocked approval: ${compliance.blocking.map((issue) => issue.detail).join(" ")}`,
      };
    }
  }
  const updated = await prisma.marketingDraft.update({
    where: { id: draft.id },
    data: {
      status: input.decision,
      reviewerId: input.reviewerId,
      reviewedAt: new Date(),
    },
  });
  if (input.decision === "APPROVED" && draft.kind === "PROFILE_BLURB" && draft.candidateId) {
    const candidate = await prisma.candidate.findUnique({ where: { id: draft.candidateId } });
    if (candidate?.photoConsent) {
      await prisma.candidate.update({
        where: { id: candidate.id },
        data: { publicBlurb: draft.body },
      });
    }
  }
  await writeAudit({
    actorId: input.reviewerId,
    action: "marketing.review",
    entityType: "MarketingDraft",
    entityId: draft.id,
    metadata: { decision: input.decision, publishedToProfile: input.decision === "APPROVED" && draft.kind === "PROFILE_BLURB" },
    ip: input.ip,
  });
  return { ok: true as const, draft: updated };
}

export async function redactCandidate(input: { candidateId: string; actorId: string; ip: string }) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    include: { documents: true },
  });
  if (!candidate) return { ok: false as const, error: "Profile not found" };
  for (const document of candidate.documents) {
    await deleteObject(document.storageKey).catch(() => undefined);
  }
  await prisma.$transaction([
    prisma.document.deleteMany({ where: { candidateId: candidate.id } }),
    prisma.candidate.update({
      where: { id: candidate.id },
      data: {
        fullName: "Redacted profile",
        email: null,
        phone: null,
        publicBlurb: "",
        householdExperience: "",
        internalNotes: "",
        passportNumberEnc: null,
        finEnc: null,
        medicalNotesEnc: null,
        photoConsent: false,
        status: "WITHDRAWN",
        redactedAt: new Date(),
      },
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
  }
  await writeAudit({
    actorId: input.actorId,
    action: "privacy.redact",
    entityType: "Candidate",
    entityId: candidate.id,
    metadata: { documentsRemoved: candidate.documents.length },
    ip: input.ip,
  });
  return { ok: true as const };
}
