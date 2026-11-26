import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { momRules } from "@/config/mom-rules";
import { toMatchable } from "@/lib/candidates/dto";
import { explanationFacts } from "@/lib/matching/explain";
import { textSimilarity } from "@/lib/ai/embeddings";
import { rankCandidates } from "@/lib/matching/score";
import { coerceWeights } from "@/lib/matching/weights";
import { requestFromPayload } from "@/lib/services/employers";
import { explainRanking } from "@/lib/ai/drafts";

export async function runRanking(input: {
  requirementId: string;
  actorId: string;
  ip: string;
  includeScreened?: boolean;
}) {
  const requirement = await prisma.employerRequirement.findUnique({
    where: { id: input.requirementId },
  });
  if (!requirement) return { ok: false as const, error: "Requirement not found" };
  const request = requestFromPayload(requirement.id, requirement.payload);
  if (!request) return { ok: false as const, error: "Requirement snapshot is incomplete" };

  const statuses = input.includeScreened ? (["AVAILABLE", "SCREENED"] as const) : (["AVAILABLE"] as const);
  const candidates = await prisma.candidate.findMany({
    where: { status: { in: [...statuses] }, redactedAt: null },
  });
  const storedWeights = await prisma.matchWeightProfile.findUnique({
    where: { requirementId: requirement.id },
  });
  const weights = coerceWeights(storedWeights?.weights ?? request.weights);
  const matchable = candidates.map(toMatchable);
  const semantic: Record<string, { score: number; source: "deterministic" | "embedding" }> = {};
  if (weights.semantic > 0) {
    for (const candidate of matchable) {
      semantic[candidate.id] = await textSimilarity(candidate.profileText ?? "", request.householdNotes ?? "");
    }
  }
  const ranked = rankCandidates(matchable, request, momRules, {
    weights,
    semantic: weights.semantic > 0 ? semantic : undefined,
  });

  await prisma.match.deleteMany({
    where: { requirementId: requirement.id, decision: "SUGGESTED" },
  });

  const topEligible = ranked.filter((row) => row.eligible).slice(0, 5);
  const explanations = new Map<string, { text: string; source: string }>();
  for (const row of topEligible) {
    explanations.set(row.candidateId, await explainRanking(explanationFacts(row)));
  }

  for (const row of ranked) {
    const explanation = explanations.get(row.candidateId);
    await prisma.match.upsert({
      where: {
        requirementId_candidateId: {
          requirementId: requirement.id,
          candidateId: row.candidateId,
        },
      },
      create: {
        requirementId: requirement.id,
        candidateId: row.candidateId,
        employerId: requirement.employerId,
        score: row.breakdown?.total ?? null,
        eligible: row.eligible,
        ineligibleReasons: row.reasons,
        breakdown: row.breakdown ?? { withheld: true },
        explanation: explanation?.text ?? "",
        explanationSource: explanation?.source ?? "template",
        decision: "SUGGESTED",
      },
      update: {
        score: row.breakdown?.total ?? null,
        eligible: row.eligible,
        ineligibleReasons: row.reasons,
        breakdown: row.breakdown ?? { withheld: true },
        explanation: explanation?.text ?? "",
        explanationSource: explanation?.source ?? "template",
      },
    });
  }

  await writeAudit({
    actorId: input.actorId,
    action: "match.rank",
    entityType: "EmployerRequirement",
    entityId: requirement.id,
    metadata: {
      considered: ranked.length,
      eligible: ranked.filter((row) => row.eligible).length,
      weights,
    },
    ip: input.ip,
  });

  return { ok: true as const, count: ranked.length };
}

export async function decideMatch(input: {
  matchId: string;
  decision: "STAFF_APPROVED" | "STAFF_REJECTED";
  actorId: string;
  ip: string;
}) {
  const match = await prisma.match.findUnique({
    where: { id: input.matchId },
    include: { candidate: true },
  });
  if (!match) return { ok: false as const, error: "Match not found" };
  if (input.decision === "STAFF_APPROVED" && !match.eligible) {
    return { ok: false as const, error: "Staff cannot approve a profile that failed eligibility gates." };
  }
  if (input.decision === "STAFF_APPROVED" && match.candidate.status !== "AVAILABLE") {
    return { ok: false as const, error: "Only an available profile can be approved into a match." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        decision: input.decision,
        decidedById: input.actorId,
        decidedAt: new Date(),
      },
    });
    if (input.decision === "STAFF_APPROVED") {
      await tx.candidate.update({
        where: { id: match.candidateId },
        data: { status: "MATCHED" },
      });
    }
  });

  await writeAudit({
    actorId: input.actorId,
    action: "match.decide",
    entityType: "Match",
    entityId: match.id,
    metadata: { decision: input.decision, candidateId: match.candidateId },
    ip: input.ip,
  });
  return { ok: true as const };
}
