import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { suggestFromEvidence, type OutcomeCompletion } from "@/lib/matching/outcomes";
import { coerceWeights, type ScoreWeights } from "@/lib/matching/weights";

const DAY_MS = 24 * 60 * 60 * 1000;

export function placementDurationDays(startedOn: Date, endedOn: Date | null, now = new Date()): number {
  const end = endedOn ?? now;
  return Math.max(0, Math.round((end.getTime() - startedOn.getTime()) / DAY_MS));
}

export async function recordPlacementOutcome(input: {
  matchId: string;
  startedOn: Date;
  endedOn?: Date;
  checkInMonth?: number;
  completion: OutcomeCompletion;
  reasonCategory: string;
  employerSatisfaction: number;
  helperSatisfaction: number;
  notes: string;
  actorId: string;
  ip: string;
}) {
  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  if (!match) return { ok: false as const, error: "Match not found." };
  const durationDays = placementDurationDays(input.startedOn, input.endedOn ?? null);
  const row = await prisma.placementOutcome.create({
    data: {
      matchId: match.id,
      candidateId: match.candidateId,
      employerId: match.employerId,
      startedOn: input.startedOn,
      endedOn: input.endedOn ?? null,
      checkInMonth: input.completion === "CHECK_IN" ? input.checkInMonth ?? null : null,
      durationDays,
      completion: input.completion,
      reasonCategory: input.completion === "EARLY_TERMINATION" ? input.reasonCategory : input.reasonCategory,
      employerSatisfaction: input.employerSatisfaction,
      helperSatisfaction: input.helperSatisfaction,
      notes: input.notes,
      recordedById: input.actorId,
    },
  });
  await writeAudit({
    actorId: input.actorId,
    action: "placement.outcome",
    entityType: "PlacementOutcome",
    entityId: row.id,
    metadata: {
      completion: input.completion,
      reasonCategory: input.completion === "EARLY_TERMINATION" ? input.reasonCategory : "",
      durationDays,
      checkInMonth: input.completion === "CHECK_IN" ? input.checkInMonth ?? null : null,
      employerSatisfaction: input.employerSatisfaction,
    },
    ip: input.ip,
  });
  return { ok: true as const, id: row.id, durationDays };
}

export async function outcomeSuggestion(employerId: string, current: ScoreWeights) {
  const rows = await prisma.placementOutcome.findMany({
    where: { employerId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      completion: true,
      reasonCategory: true,
      employerSatisfaction: true,
      helperSatisfaction: true,
    },
  });
  return suggestFromEvidence(coerceWeights(current), {
    outcomes: rows.map((row) => ({
      completion: row.completion as OutcomeCompletion,
      reasonCategory: row.reasonCategory,
      employerSatisfaction: row.employerSatisfaction,
      helperSatisfaction: row.helperSatisfaction,
    })),
  });
}
