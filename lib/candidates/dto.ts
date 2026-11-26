import type { Candidate, Skill } from "@prisma/client";

export type PublicCandidate = {
  id: string;
  fullName: string;
  nationality: string;
  experienceYears: number;
  educationYears: number;
  skills: Skill[];
  languages: string[];
  salaryExpectationSgd: number;
  availableFrom: string;
  publicBlurb: string;
  householdExperience: string;
  fictional: boolean;
  photoConsent: boolean;
  hasPhoto: boolean;
};

export function ageYears(dateOfBirth: Date, on = new Date()): number {
  let age = on.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const month = on.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (month < 0 || (month === 0 && on.getUTCDate() < dateOfBirth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export function toPublicCandidate(
  candidate: Candidate & { documents?: { kind: string }[] },
): PublicCandidate {
  const hasPhoto = Boolean(
    candidate.photoConsent &&
      candidate.documents?.some((document) => document.kind === "PHOTO"),
  );
  return {
    id: candidate.id,
    fullName: candidate.fullName,
    nationality: candidate.nationality,
    experienceYears: candidate.experienceYears,
    educationYears: candidate.educationYears,
    skills: candidate.skills,
    languages: candidate.languages,
    salaryExpectationSgd: candidate.salaryExpectationSgd,
    availableFrom: candidate.availableFrom.toISOString().slice(0, 10),
    publicBlurb: candidate.publicBlurb,
    householdExperience: candidate.householdExperience,
    fictional: candidate.fictional,
    photoConsent: candidate.photoConsent,
    hasPhoto,
  };
}

function levelMap(value: unknown): Record<string, "BASIC" | "INTERMEDIATE" | "ADVANCED"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const levels = ["BASIC", "INTERMEDIATE", "ADVANCED"] as const;
  const result: Record<string, "BASIC" | "INTERMEDIATE" | "ADVANCED"> = {};
  for (const [key, level] of Object.entries(value)) {
    if (levels.includes(level as (typeof levels)[number])) {
      result[key] = level as (typeof levels)[number];
    }
  }
  return result;
}

export function toMatchable(candidate: Candidate) {
  return {
    id: candidate.id,
    skills: candidate.skills,
    languages: candidate.languages,
    experienceYears: candidate.experienceYears,
    salaryExpectationSgd: candidate.salaryExpectationSgd,
    availableFrom: candidate.availableFrom,
    profileText: candidate.householdExperience,
    skillLevels: levelMap(candidate.skillLevels),
    languageLevels: levelMap(candidate.languageLevels),
    careNeeds: candidate.careNeeds,
    placementKind: candidate.placementKind,
    eligibility: {
      ageYears: ageYears(candidate.dateOfBirth),
      nationality: candidate.nationality,
      educationYears: candidate.educationYears,
      sex: candidate.sex,
      medicallyUnfit: candidate.medicalFitStatus === "UNFIT",
    },
  };
}
