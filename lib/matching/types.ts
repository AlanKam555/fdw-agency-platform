import type { Skill } from "@prisma/client";
import type { ScoreWeights } from "@/lib/matching/weights";

/**
 * The only candidate facts the ranker is allowed to see.
 * Passport, FIN, medical notes, religion, race, and pregnancy are not fields.
 * Age, sex, nationality, and education are eligibility gates, not score inputs.
 */
export type Proficiency = "BASIC" | "INTERMEDIATE" | "ADVANCED";

export type MatchableCandidate = {
  id: string;
  skills: Skill[];
  languages: string[];
  experienceYears: number;
  salaryExpectationSgd: number;
  availableFrom: Date;
  profileText?: string;
  skillLevels?: Record<string, Proficiency>;
  languageLevels?: Record<string, Proficiency>;
  careNeeds?: string[];
  placementKind?: "NEW_HIRE" | "TRANSFER" | "RETURNING";
  eligibility: {
    ageYears: number;
    nationality: string;
    educationYears: number;
    sex: "FEMALE" | "MALE" | "UNSPECIFIED";
    medicallyUnfit: boolean;
  };
};

export type EmployerRequest = {
  id: string;
  skillsRequired: Skill[];
  languagesPreferred: string[];
  experienceTargetYears: number;
  budgetMinSgd: number;
  budgetMaxSgd: number;
  startDate: Date;
  householdNotes?: string;
  careNeeds?: string[];
  skillMinimums?: Record<string, Proficiency>;
  languageMinimums?: Record<string, Proficiency>;
  placementPreference?: "ANY" | "NEW_HIRE" | "TRANSFER" | "RETURNING";
  weights?: ScoreWeights;
};

export type ScoreBreakdown = {
  skills: number;
  languages: number;
  experience: number;
  salary: number;
  availability: number;
  semantic: number;
  proficiency: number;
  careNeeds: number;
  placement: number;
  total: number;
  weights: ScoreWeights;
  semanticSource: "none" | "deterministic" | "embedding";
  skillsCovered: string[];
  skillsMissing: string[];
  languagesCovered: string[];
  languagesMissing: string[];
  careCovered: string[];
  careMissing: string[];
};

export type IneligibleReason =
  | "AGE_BELOW_MINIMUM"
  | "AGE_AT_OR_ABOVE_MAXIMUM"
  | "SOURCE_COUNTRY"
  | "EDUCATION"
  | "STATUTORY_SEX"
  | "MEDICAL_FITNESS";

export type RankedCandidate = {
  candidateId: string;
  eligible: boolean;
  reasons: IneligibleReason[];
  breakdown: ScoreBreakdown | null;
};
