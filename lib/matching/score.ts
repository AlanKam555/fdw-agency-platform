import type { MomRules } from "@/config/mom-rules";
import { countryOnList } from "@/config/mom-rules";
import { deterministicSimilarity } from "@/lib/matching/semantic";
import type {
  EmployerRequest,
  IneligibleReason,
  MatchableCandidate,
  Proficiency,
  RankedCandidate,
  ScoreBreakdown,
} from "@/lib/matching/types";
import { DEFAULT_WEIGHTS, coerceWeights, type ScoreWeights } from "@/lib/matching/weights";

export { DEFAULT_WEIGHTS as SCORE_WEIGHTS };

const DAY_MS = 24 * 60 * 60 * 1000;
const LEVEL: Record<Proficiency, number> = { BASIC: 1, INTERMEDIATE: 2, ADVANCED: 3 };

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function share(covered: number, required: number, weight: number): number {
  if (weight <= 0) return 0;
  if (required === 0) return weight;
  return Math.round((covered / required) * weight);
}

function meets(actual: Proficiency | undefined, minimum: Proficiency): boolean {
  return LEVEL[actual ?? "BASIC"] >= LEVEL[minimum];
}

export function eligibilityReasons(candidate: MatchableCandidate, rules: MomRules): IneligibleReason[] {
  const reasons: IneligibleReason[] = [];
  const { eligibility: gate } = candidate;
  if (gate.ageYears < rules.fdw.minAgeYears) reasons.push("AGE_BELOW_MINIMUM");
  if (gate.ageYears >= rules.fdw.maxAgeYearsExclusive) reasons.push("AGE_AT_OR_ABOVE_MAXIMUM");
  if (!countryOnList(gate.nationality, rules.fdw.approvedSourceCountries)) reasons.push("SOURCE_COUNTRY");
  if (gate.educationYears < rules.fdw.minEducationYears) reasons.push("EDUCATION");
  if (rules.fdw.requiredSex && gate.sex !== rules.fdw.requiredSex) reasons.push("STATUTORY_SEX");
  if (gate.medicallyUnfit) reasons.push("MEDICAL_FITNESS");
  return reasons;
}

export function scoreJobFit(
  candidate: MatchableCandidate,
  request: EmployerRequest,
  weights: ScoreWeights = request.weights ?? DEFAULT_WEIGHTS,
  semantic?: { score: number; source: ScoreBreakdown["semanticSource"] },
): ScoreBreakdown {
  const required = request.skillsRequired;
  const covered = required.filter((skill) => candidate.skills.includes(skill));
  const missing = required.filter((skill) => !candidate.skills.includes(skill));
  const skills = share(covered.length, required.length, weights.skills);

  const wanted = request.languagesPreferred.map(normalise);
  const spoken = new Set(candidate.languages.map(normalise));
  const languagesCovered = request.languagesPreferred.filter((language) => spoken.has(normalise(language)));
  const languagesMissing = request.languagesPreferred.filter((language) => !spoken.has(normalise(language)));
  const languages = share(languagesCovered.length, wanted.length, weights.languages);

  const target = Math.max(1, request.experienceTargetYears);
  const experience = Math.round(Math.min(1, candidate.experienceYears / target) * weights.experience);

  let salary = 0;
  if (weights.salary > 0) {
    if (candidate.salaryExpectationSgd <= request.budgetMaxSgd) salary = weights.salary;
    else if (request.budgetMaxSgd > 0) {
      const over = (candidate.salaryExpectationSgd - request.budgetMaxSgd) / request.budgetMaxSgd;
      salary = Math.max(0, Math.round(weights.salary * (1 - over * 2)));
    }
  }

  const lagDays = Math.ceil((candidate.availableFrom.getTime() - request.startDate.getTime()) / DAY_MS);
  let availability = 0;
  if (weights.availability > 0) {
    if (lagDays <= 0) availability = weights.availability;
    else if (lagDays <= 14) availability = Math.round(weights.availability * 0.6);
    else if (lagDays <= 30) availability = Math.round(weights.availability * 0.3);
  }

  const careRequired = request.careNeeds ?? [];
  const careHeld = new Set((candidate.careNeeds ?? []).map(normalise));
  const careCovered = careRequired.filter((need) => careHeld.has(normalise(need)));
  const careMissing = careRequired.filter((need) => !careHeld.has(normalise(need)));
  const careNeeds = share(careCovered.length, careRequired.length, weights.careNeeds);

  const skillMins = Object.entries(request.skillMinimums ?? {});
  const languageMins = Object.entries(request.languageMinimums ?? {});
  const checks = skillMins.length + languageMins.length;
  const passed =
    skillMins.filter(([skill, level]) => meets(candidate.skillLevels?.[skill], level)).length +
    languageMins.filter(([language, level]) => meets(candidate.languageLevels?.[language], level)).length;
  const proficiency = share(passed, checks, weights.proficiency);

  const preference = request.placementPreference ?? "ANY";
  const placementKind = candidate.placementKind ?? "NEW_HIRE";
  const placement =
    weights.placement <= 0 ? 0 : preference === "ANY" || preference === placementKind ? weights.placement : 0;

  let semanticPoints = 0;
  let semanticSource: ScoreBreakdown["semanticSource"] = "none";
  if (weights.semantic > 0) {
    const score =
      semantic?.score ??
      deterministicSimilarity(candidate.profileText ?? "", request.householdNotes ?? "");
    semanticSource = semantic?.source ?? "deterministic";
    semanticPoints = Math.round(Math.max(0, Math.min(1, score)) * weights.semantic);
  }

  const total =
    skills + languages + experience + salary + availability + semanticPoints + proficiency + careNeeds + placement;
  return {
    skills,
    languages,
    experience,
    salary,
    availability,
    semantic: semanticPoints,
    proficiency,
    careNeeds,
    placement,
    total,
    weights,
    semanticSource,
    skillsCovered: covered,
    skillsMissing: missing,
    languagesCovered,
    languagesMissing,
    careCovered,
    careMissing,
  };
}

export function rankCandidates(
  candidates: MatchableCandidate[],
  request: EmployerRequest,
  rules: MomRules,
  options?: { weights?: ScoreWeights; semantic?: Record<string, { score: number; source: ScoreBreakdown["semanticSource"] }> },
): RankedCandidate[] {
  const weights = options?.weights ?? coerceWeights(request.weights);
  const ranked = candidates.map((candidate) => {
    const reasons = eligibilityReasons(candidate, rules);
    const eligible = reasons.length === 0;
    return {
      candidateId: candidate.id,
      eligible,
      reasons,
      breakdown: eligible
        ? scoreJobFit(candidate, request, weights, options?.semantic?.[candidate.id])
        : null,
    };
  });

  ranked.sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    const scoreA = a.breakdown?.total ?? -1;
    const scoreB = b.breakdown?.total ?? -1;
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.candidateId.localeCompare(b.candidateId);
  });

  return ranked;
}

export function experienceTarget(input: {
  childrenCount: number;
  elderlyCount: number;
  hasPets: boolean;
}): number {
  return Math.min(10, 2 + input.childrenCount + input.elderlyCount + (input.hasPets ? 1 : 0));
}
