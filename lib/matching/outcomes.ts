import type { ScoreWeights } from "@/lib/matching/weights";
import { suggestWeightNudge } from "@/lib/matching/weights";

export const OUTCOME_COMPLETIONS = ["COMPLETED", "EARLY_TERMINATION", "CHECK_IN"] as const;
export type OutcomeCompletion = (typeof OUTCOME_COMPLETIONS)[number];

export const TERMINATION_REASONS = [
  "SKILL_GAP",
  "LANGUAGE_GAP",
  "CARE_MISMATCH",
  "EXPERIENCE_GAP",
  "SALARY",
  "AVAILABILITY",
  "REST_DAY",
  "MEDICAL",
  "TRANSFER",
  "EMPLOYER_REQUEST",
  "HELPER_REQUEST",
  "MUTUAL",
  "OTHER",
] as const;

export type TerminationReason = (typeof TERMINATION_REASONS)[number];

const REASON_GAP: Partial<Record<TerminationReason, string>> = {
  SKILL_GAP: "skill",
  LANGUAGE_GAP: "language",
  CARE_MISMATCH: "care",
  EXPERIENCE_GAP: "experience",
  SALARY: "salary",
  AVAILABILITY: "availability",
  TRANSFER: "placement",
};

export type OutcomeSignal = {
  completion: OutcomeCompletion;
  reasonCategory: string;
  employerSatisfaction: number;
  helperSatisfaction: number;
};

export function suggestFromEvidence(
  current: ScoreWeights,
  input: { gaps?: string[]; outcomes: OutcomeSignal[] },
): { suggestion: ScoreWeights; evidenceCount: number; gapsUsed: string[] } {
  const gaps = [...(input.gaps ?? [])];
  for (const outcome of input.outcomes) {
    const mapped = REASON_GAP[outcome.reasonCategory as TerminationReason];
    if (!mapped) continue;
    const early = outcome.completion === "EARLY_TERMINATION";
    const unhappy = outcome.employerSatisfaction <= 2;
    if (early || unhappy) gaps.push(mapped);
  }
  const gapsUsed = [...new Set(gaps)];
  return {
    suggestion: suggestWeightNudge(current, gapsUsed),
    evidenceCount: input.outcomes.length,
    gapsUsed,
  };
}

export const PROTECTED_OUTCOME_FIELDS = ["religion", "race", "ethnicity", "pregnancy"] as const;
