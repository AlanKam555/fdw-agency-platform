import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { biasReport } from "@/lib/matching/fairness";
import { coerceWeights, suggestWeightNudge, weightsAreValid, type ScoreWeights } from "@/lib/matching/weights";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCampaign(input: {
  authorId: string;
  title: string;
  channel: string;
  startsOn: string;
  endsOn: string;
  objective?: string;
  ip: string;
}) {
  const startsOn = new Date(input.startsOn);
  const endsOn = new Date(input.endsOn);
  if (Number.isNaN(startsOn.getTime()) || Number.isNaN(endsOn.getTime())) {
    throw new Error("Campaign dates are not valid.");
  }
  const campaign = await prisma.campaign.create({
    data: {
      title: input.title,
      objective: input.objective ?? "",
      authorId: input.authorId,
      startsOn,
      endsOn,
      slots: {
        create: {
          channel: input.channel,
          scheduledFor: startsOn,
          language: "en",
        },
      },
    },
  });
  await writeAudit({
    actorId: input.authorId,
    action: "campaign.create",
    entityType: "Campaign",
    entityId: campaign.id,
    ip: input.ip,
  });
  return campaign;
}

export function buildUtm(input: { path: string; source: string; medium: string; campaign: string; content?: string }): string | null {
  if (!input.path.startsWith("/") || input.path.startsWith("//")) return null;
  const url = new URL(input.path, "http://localhost");
  url.searchParams.set("utm_source", input.source);
  url.searchParams.set("utm_medium", input.medium);
  url.searchParams.set("utm_campaign", input.campaign);
  if (input.content) url.searchParams.set("utm_content", input.content);
  return `${url.pathname}${url.search}`;
}

export async function saveUtmLink(input: {
  createdById: string;
  path: string;
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  ip: string;
}) {
  const built = buildUtm(input);
  if (!built) return { ok: false as const, error: "Path must start with a single slash." };
  const row = await prisma.utmLink.create({
    data: {
      label: input.campaign,
      destinationPath: input.path,
      source: input.source,
      medium: input.medium,
      campaign: input.campaign,
      content: input.content ?? "",
      createdById: input.createdById,
    },
  });
  await writeAudit({
    actorId: input.createdById,
    action: "utm.create",
    entityType: "UtmLink",
    entityId: row.id,
    ip: input.ip,
  });
  return { ok: true as const, url: built };
}

export async function saveAgencyVoice(input: {
  actorId: string;
  brandVoice: string;
  voiceNotes: string;
  eaLicenceNo: string;
  ip: string;
}) {
  await prisma.agencySetting.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      eaLicenceNo: input.eaLicenceNo,
      brandVoice: input.brandVoice,
      voiceNotes: input.voiceNotes,
    },
    update: {
      eaLicenceNo: input.eaLicenceNo,
      brandVoice: input.brandVoice,
      voiceNotes: input.voiceNotes,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "agency.voice",
    entityType: "AgencySetting",
    entityId: "default",
    ip: input.ip,
  });
}

export async function saveMatchWeights(input: {
  requirementId: string;
  actorId: string;
  weights: ScoreWeights;
  ip: string;
}) {
  if (!weightsAreValid(input.weights)) return { ok: false as const, error: "Weights must be whole numbers from 0 to 100 and sum to 100." };
  await prisma.matchWeightProfile.upsert({
    where: { requirementId: input.requirementId },
    create: {
      requirementId: input.requirementId,
      weights: input.weights,
      updatedById: input.actorId,
    },
    update: {
      weights: input.weights,
      updatedById: input.actorId,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "matching.weights",
    entityType: "EmployerRequirement",
    entityId: input.requirementId,
    metadata: { weights: input.weights },
    ip: input.ip,
  });
  return { ok: true as const };
}

export async function recordInterviewFeedback(input: {
  interviewId: string;
  actorId: string;
  outcome: "PROCEED" | "HOLD" | "DECLINED";
  gaps: string[];
  notes: string;
  ip: string;
}) {
  const interview = await prisma.interviewRequest.findUnique({ where: { id: input.interviewId } });
  if (!interview) return { ok: false as const, error: "Interview not found" };
  const profile = await prisma.matchWeightProfile.findFirst({
    where: { requirement: { employerId: interview.employerId } },
    orderBy: { updatedAt: "desc" },
  });
  const current = coerceWeights(profile?.weights);
  const suggestion = suggestWeightNudge(current, input.gaps);
  await prisma.interviewFeedback.upsert({
    where: { interviewId: interview.id },
    create: {
      interviewId: interview.id,
      rating: input.outcome === "PROCEED" ? 5 : input.outcome === "HOLD" ? 3 : 1,
      outcome: input.outcome,
      gaps: input.gaps,
      notes: input.notes,
      suggestedWeights: suggestion,
      createdById: input.actorId,
    },
    update: {
      rating: input.outcome === "PROCEED" ? 5 : input.outcome === "HOLD" ? 3 : 1,
      outcome: input.outcome,
      gaps: input.gaps,
      notes: input.notes,
      suggestedWeights: suggestion,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "interview.feedback",
    entityType: "InterviewRequest",
    entityId: interview.id,
    metadata: { outcome: input.outcome, gaps: input.gaps },
    ip: input.ip,
  });
  return { ok: true as const, suggestion };
}

export async function matchingBiasReport() {
  const matches = await prisma.match.findMany({
    take: 500,
    orderBy: { createdAt: "desc" },
    include: { candidate: { select: { nationality: true } } },
  });
  return biasReport(
    matches.map((match) => ({
      nationality: match.candidate.nationality,
      eligible: match.eligible,
      score: match.score,
      approved: match.decision === "STAFF_APPROVED",
    })),
  );
}

export async function funnelSnapshot() {
  const [enquiries, requirements, approved, deployed, bySource] = await Promise.all([
    prisma.enquiry.count(),
    prisma.employerRequirement.count(),
    prisma.match.count({ where: { decision: "STAFF_APPROVED" } }),
    prisma.candidate.count({ where: { status: "DEPLOYED" } }),
    prisma.enquiry.groupBy({ by: ["utmSource"], _count: { _all: true } }),
  ]);
  return {
    enquiries,
    requirements,
    approved,
    deployed,
    sources: bySource.map((row) => ({ source: row.utmSource || "(none)", count: row._count._all })),
  };
}

export async function requestTestimonial(input: { authorId: string; employerEmail: string; name?: string; ip: string }) {
  const token = randomBytes(24).toString("hex");
  const row = await prisma.testimonialRequest.create({
    data: {
      email: input.employerEmail.toLowerCase(),
      name: input.name?.trim() || "Employer",
      tokenHash: tokenHash(token),
      status: "REQUESTED",
    },
  });
  await writeAudit({
    actorId: input.authorId,
    action: "testimonial.request",
    entityType: "TestimonialRequest",
    entityId: row.id,
    ip: input.ip,
  });
  return { id: row.id, path: `/testimonials/share/${token}` };
}

export async function submitTestimonial(input: { token: string; quote: string; authorName: string }) {
  const row = await prisma.testimonialRequest.findUnique({ where: { tokenHash: tokenHash(input.token) } });
  if (!row || row.status === "APPROVED" || row.status === "DECLINED") return { ok: false as const, error: "This link is not open." };
  await prisma.testimonialRequest.update({
    where: { id: row.id },
    data: {
      submittedText: input.quote,
      name: input.authorName,
      status: "SUBMITTED",
      submittedAt: new Date(),
    },
  });
  return { ok: true as const };
}

export async function reviewTestimonial(input: {
  id: string;
  actorId: string;
  decision: "APPROVED" | "DECLINED";
  ip: string;
}) {
  const row = await prisma.testimonialRequest.findUnique({ where: { id: input.id } });
  if (!row || row.status !== "SUBMITTED") return { ok: false as const, error: "Only a submitted quote can be reviewed." };
  await prisma.testimonialRequest.update({
    where: { id: row.id },
    data: {
      status: input.decision,
      reviewedAt: new Date(),
      publishedQuote: input.decision === "APPROVED" ? row.submittedText : "",
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "testimonial.review",
    entityType: "TestimonialRequest",
    entityId: row.id,
    metadata: { decision: input.decision },
    ip: input.ip,
  });
  return { ok: true as const };
}
