import type { Skill } from "@prisma/client";

export const SKILL_LABELS: Record<Skill, string> = {
  INFANT_CARE: "Infant care",
  CHILD_CARE: "Child care",
  ELDERLY_CARE: "Elderly care",
  COOKING: "Cooking",
  HOUSEKEEPING: "Housekeeping",
  PET_CARE: "Pet care",
  SPECIAL_NEEDS: "Special needs",
  DRIVING: "Driving",
};

export const STATUS_LABELS: Record<string, string> = {
  APPLIED: "Applied",
  SCREENED: "Screened",
  AVAILABLE: "Available",
  MATCHED: "Matched",
  MOM_SUBMITTED: "MOM submitted",
  APPROVED: "Approved",
  DEPLOYED: "Deployed",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
};

export const LANGUAGES = [
  "English",
  "Mandarin",
  "Malay",
  "Tamil",
  "Tagalog",
  "Bahasa Indonesia",
  "Burmese",
  "Khmer",
  "Sinhala",
  "Thai",
  "Bengali",
  "Hindi",
  "Cantonese",
];

export function skillLabel(skill: string): string {
  return SKILL_LABELS[skill as Skill] ?? skill;
}
