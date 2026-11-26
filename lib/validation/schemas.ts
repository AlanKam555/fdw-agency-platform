import { z } from "zod";

export const PDPA_VERSION = "HL-PDPA-2026-11";

function asBoolean(value: unknown): boolean {
  if (value === true || value === "true" || value === "on" || value === "1") return true;
  return false;
}

const formBoolean = z.preprocess((value) => {
  if (value == null || value === "") return undefined;
  return asBoolean(value);
}, z.boolean());
const requiredConsent = z.preprocess(asBoolean, z.literal(true));
const optionalBoolean = z.preprocess((value) => {
  if (value == null || value === "") return null;
  return asBoolean(value);
}, z.boolean().nullable());

export const SKILLS = [
  "INFANT_CARE",
  "CHILD_CARE",
  "ELDERLY_CARE",
  "COOKING",
  "HOUSEKEEPING",
  "PET_CARE",
  "SPECIAL_NEEDS",
  "DRIVING",
] as const;

export const skillSchema = z.enum(SKILLS);

export const languageSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[\p{L}\s'-]+$/u, "Use letters only");

const personName = z.string().trim().min(2).max(80);
const email = z.string().trim().email().max(160);
const phone = z.string().trim().min(8).max(20);
const money = z.coerce.number().int().min(0).max(20000);
const dateField = z.coerce.date();

export const passwordSchema = z
  .string()
  .min(10)
  .max(72)
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number");

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

export const registerSchema = z.object({
  role: z.enum(["EMPLOYER", "CANDIDATE"]),
  name: personName,
  email,
  password: passwordSchema,
  pdpaConsent: requiredConsent,
});

const utmField = z.string().trim().max(80).optional().or(z.literal(""));

export const contactSchema = z.object({
  name: personName,
  email,
  phone: phone.optional().or(z.literal("")),
  message: z.string().trim().min(10).max(2000),
  pdpaConsent: requiredConsent,
  source: utmField,
  utmSource: utmField,
  utmMedium: utmField,
  utmCampaign: utmField,
  utmContent: utmField,
  landingPath: z.string().trim().max(200).optional().or(z.literal("")),
});

export const candidateApplicationSchema = z
  .object({
    fullName: personName,
    email,
    phone,
    password: passwordSchema.optional().or(z.literal("")),
    nationality: z.string().trim().min(2).max(60),
    dateOfBirth: dateField,
    sex: z.enum(["FEMALE", "MALE", "UNSPECIFIED"]),
    educationYears: z.coerce.number().int().min(0).max(30),
    experienceYears: z.coerce.number().int().min(0).max(50),
    skills: z.array(skillSchema).min(1).max(8),
    languages: z.array(languageSchema).min(1).max(8),
    salaryExpectationSgd: money,
    availableFrom: dateField,
    householdExperience: z.string().trim().max(2000).default(""),
    passportNumber: z
      .string()
      .trim()
      .max(20)
      .regex(/^[A-Za-z0-9]*$/)
      .optional()
      .or(z.literal("")),
    medicalNotes: z.string().trim().max(2000).optional().or(z.literal("")),
    medicalFitStatus: z.enum(["PENDING", "FIT", "UNFIT"]).default("PENDING"),
    firstTimeInSingapore: formBoolean.default(true),
    photoConsent: formBoolean.default(false),
    pdpaConsent: requiredConsent,
    internalNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export const employerRequirementSchema = z
  .object({
    fullName: personName,
    email,
    phone,
    householdSize: z.coerce.number().int().min(1).max(20),
    childrenCount: z.coerce.number().int().min(0).max(12).default(0),
    youngestChildAge: z.coerce.number().int().min(0).max(18).optional().nullable(),
    childrenUnder7Count: z.coerce.number().int().min(0).max(12).default(0),
    measlesVaccinatedUnder7: optionalBoolean,
    elderlyCount: z.coerce.number().int().min(0).max(8),
    hasPets: formBoolean.default(false),
    petDetails: z.string().trim().max(300).optional().or(z.literal("")),
    languagesPreferred: z.array(languageSchema).max(8).default([]),
    skillsRequired: z.array(skillSchema).min(1).max(8),
    budgetMinSgd: money,
    budgetMaxSgd: money,
    startDate: dateField,
    housingType: z.enum(["HDB", "CONDO", "LANDED", "OTHER"]),
    addressArea: z.string().trim().min(2).max(80),
    dateOfBirth: dateField.optional().nullable(),
    nric: z
      .string()
      .trim()
      .max(9)
      .regex(/^[A-Za-z0-9]*$/)
      .optional()
      .or(z.literal("")),
    isUndischargedBankrupt: optionalBoolean,
    firstTimeEmployer: formBoolean.default(true),
    eopCompleted: formBoolean.default(false),
    eopCompletedOn: dateField.optional().nullable(),
    notes: z.string().trim().max(2000).default(""),
    pdpaConsent: requiredConsent,
    title: z.string().trim().min(3).max(120).optional(),
  })
  .strict()
  .refine((value) => value.budgetMaxSgd >= value.budgetMinSgd, {
    message: "Budget maximum must be at least the minimum",
    path: ["budgetMaxSgd"],
  });

export const statusSchema = z.object({
  status: z.enum([
    "APPLIED",
    "SCREENED",
    "AVAILABLE",
    "MATCHED",
    "MOM_SUBMITTED",
    "APPROVED",
    "DEPLOYED",
    "REJECTED",
    "WITHDRAWN",
  ]),
});

export const interviewSchema = z.object({
  candidateId: z.string().min(1),
  preferredWindow: z.string().trim().min(3).max(200),
});

export const shortlistSchema = z.object({
  candidateId: z.string().min(1),
});

export const marketingRequestSchema = z.object({
  kind: z.enum([
    "SOCIAL_POST",
    "AD_COPY",
    "PROFILE_BLURB",
    "CAMPAIGN_COPY",
    "BLOG_ARTICLE",
    "NEWSLETTER",
    "HEADLINE",
    "SEO_PAGE",
  ]),
  candidateId: z.string().optional(),
  notes: z.string().trim().max(1000).default(""),
  language: z.enum(["en", "zh", "ms", "ta", "tl", "id", "my"]).default("en"),
  channel: z
    .enum(["facebook", "instagram", "tiktok", "whatsapp", "google_business", "email", "blog", "seo"])
    .optional(),
  campaignId: z.string().optional(),
});

export const draftReviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export const momAttestationSchema = z.object({
  notRelated: formBoolean,
  fdwOutsideSingapore: formBoolean,
  securityBondArranged: formBoolean,
  medicalInsuranceArranged: formBoolean,
  personalAccidentArranged: formBoolean,
  addressIsNricRegistered: formBoolean,
  salaryAgreedSgd: z.coerce.number().int().min(0).max(20000),
  restDaysPerMonth: z.coerce.number().int().min(0).max(8),
  proposedSubmissionDate: dateField,
});

export const staffUserSchema = z.object({
  name: personName,
  email,
  password: passwordSchema,
  role: z.enum(["ADMIN", "STAFF"]),
});

export const sensitiveRevealSchema = z.object({
  field: z.enum(["passport", "fin", "medical", "nric"]),
});
