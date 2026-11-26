export const WEIGHT_KEYS = [
  "skills",
  "languages",
  "experience",
  "salary",
  "availability",
  "semantic",
  "proficiency",
  "careNeeds",
  "placement",
] as const;

export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type ScoreWeights = Record<WeightKey, number>;

export const DEFAULT_WEIGHTS: ScoreWeights = {
  skills: 40,
  languages: 20,
  experience: 15,
  salary: 15,
  availability: 10,
  semantic: 0,
  proficiency: 0,
  careNeeds: 0,
  placement: 0,
};

export function weightSum(weights: ScoreWeights): number {
  return WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0);
}

export function isScoreWeights(value: unknown): value is ScoreWeights {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return WEIGHT_KEYS.every((key) => Number.isInteger(record[key]) && (record[key] as number) >= 0);
}

export function coerceWeights(value: unknown): ScoreWeights {
  if (!isScoreWeights(value)) return { ...DEFAULT_WEIGHTS };
  const weights = { ...DEFAULT_WEIGHTS };
  for (const key of WEIGHT_KEYS) weights[key] = (value as ScoreWeights)[key];
  return weights;
}

export function weightsAreValid(weights: ScoreWeights): boolean {
  return WEIGHT_KEYS.every((key) => weights[key] >= 0 && weights[key] <= 100) && weightSum(weights) === 100;
}

const GAP_TO_WEIGHT: Record<string, WeightKey> = {
  skill: "skills",
  language: "languages",
  care: "careNeeds",
  experience: "experience",
};

/** Moves five points from a donor factor. Does not add nationality, age, or any protected trait. */
export function suggestWeightNudge(current: ScoreWeights, gaps: string[]): ScoreWeights {
  const next = { ...current };
  const donors: WeightKey[] = ["salary", "availability", "placement", "semantic", "experience", "proficiency"];
  for (const gap of gaps) {
    const target = GAP_TO_WEIGHT[gap];
    if (!target) continue;
    const donor = donors.find((key) => key !== target && next[key] >= 5);
    if (!donor) continue;
    next[target] += 5;
    next[donor] -= 5;
  }
  return weightsAreValid(next) ? next : current;
}
